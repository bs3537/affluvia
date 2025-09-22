import express, { type Express } from "express";
import crypto from "crypto";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import type { Goal, FinancialProfile, EstatePlan, EducationGoal } from "@shared/schema";
import { financialProfiles } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { setupAchievementRoutes } from "./routes/achievements";
import { setupDebtManagementRoutes } from "./routes/debt-management";
import { setupLifeGoalsRoutes } from "./routes/life-goals-api";
import adminRoutes from "./routes/admin";
import selfEmployedRoutes from "./routes/self-employed";
import { RothConversionEngine, RothConversionInputsSchema, ConversionStrategy } from "./roth-conversion-engine";
import { 
  validateLifeGoalCreate, 
  validateLifeGoalUpdate, 
  validateIdParam,
  validateLifeGoalBusinessLogic 
} from "./validation/life-goals-validation";
import { buildComprehensiveUserContext, generateEnhancedAIResponse } from "./ai-context-builder";
import { setupAdvisorRoutes } from './routes/advisor';
import { setupInviteRoutes } from './routes/invite';
import { setupActingAsMiddleware } from './middleware/acting-as';
import { setupReportRoutes } from './routes/report';
import plaidRoutes from './routes/plaid';
import notificationRoutes from './routes/notifications';
import willsRoutes from './routes/wills';
import retirementCalculationRoutes from './routes/retirement-calculations';
import { calculateFinancialMetricsWithPlaid } from './financial-calculations-enhanced';
import { calculateFastFinancialMetrics } from './financial-calculations-fast';
import { enqueuePostProfileCalcs } from './jobs/post-profile-calcs';
import { PlaidDataAggregator } from './services/plaid-data-aggregator';
import { cacheService } from './services/cache.service';
import { setupDashboardSnapshotRoutes } from './routes/dashboard-snapshot';
import type { DatabaseError } from 'pg';
import { mapStrategyToRisk, optimizeEducationGoal } from "./education-optimizer";
import { calculateEstateProjection, buildAssetCompositionFromProfile } from "@shared/estate/analysis";
import {
  assembleEstateInsightsContext,
  generateEstateInsightsFromContext,
  type EstateInsightsPayload,
} from "./estate-insights-generator";

const PG_UNDEFINED_TABLE = '42P01';

function isMissingEducationScenarioTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const pgError = error as Partial<DatabaseError> & { code?: string };
  return pgError.code === PG_UNDEFINED_TABLE;
}

// Parse estate planning document using Gemini API

async function parseEstateDocument(
  pdfBuffer: Buffer,
  documentType: string
): Promise<any> {
  try {
    // First, let's just return a simple response to test the flow
    console.log('parseEstateDocument called with:', {
      bufferSize: pdfBuffer.length,
      documentType
    });
    
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    // Convert PDF buffer to base64 for Gemini
    const pdfBase64 = pdfBuffer.toString('base64');

    const prompt = `You are an expert estate planning attorney analyzing an estate planning document.

Document Type: ${documentType}

Please analyze this document and extract the following key information:

1. **Document Summary**: Brief overview of the document's purpose and scope
2. **Key Parties**:
   - Grantor/Testator name and details
   - Executor/Trustee information
   - Beneficiaries and their relationships
3. **Asset Distribution**:
   - Specific bequests
   - Percentage allocations
   - Contingency plans
4. **Important Provisions**:
   - Guardian designations (if applicable)
   - Healthcare directives
   - Power of attorney assignments
   - Special instructions or conditions
5. **Tax Considerations**:
   - Estate tax planning strategies mentioned
   - Trust structures for tax benefits
6. **Document Details**:
   - Execution date
   - Prepared by (attorney/firm)
   - Witness information
   - Notarization status

Return the analysis in JSON format with these fields:
{
  "summary": "Brief document summary",
  "executionDate": "YYYY-MM-DD format if found",
  "preparedBy": "Attorney or firm name",
  "testator": {
    "name": "Full name",
    "details": "Any relevant details"
  },
  "executor": {
    "name": "Full name",
    "relationship": "Relationship to testator"
  },
  "beneficiaries": [
    {
      "name": "Beneficiary name",
      "relationship": "Relationship",
      "distribution": "What they receive"
    }
  ],
  "guardianship": {
    "minorChildren": "Guardian designation if any",
    "instructions": "Special instructions"
  },
  "healthcareDirectives": "Summary of healthcare wishes",
  "powerOfAttorney": {
    "financial": "Financial POA details",
    "healthcare": "Healthcare POA details"
  },
  "taxStrategies": ["List of tax planning strategies mentioned"],
  "specialProvisions": ["Any special conditions or instructions"],
  "recommendations": ["Suggested updates or improvements based on modern estate planning best practices"]
}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
      { text: prompt },
    ]);

    const response = result.response;
    const text = response.text();
    
    console.log('Gemini response for estate document:', text.substring(0, 500) + '...');
    
    // Parse JSON from response - look for the first complete JSON object
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      try {
        const jsonString = text.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Failed to parse Gemini JSON response:', parseError);
        console.log('Attempted to parse:', text.substring(jsonStart, Math.min(jsonStart + 200, jsonEnd + 1)));
      }
    }
    
    // Fallback if no JSON found
    return {
      summary: "Document uploaded successfully. Content analysis in progress.",
      executionDate: null,
      preparedBy: null,
      recommendations: ["Document received. Manual review recommended for detailed analysis."],
      rawResponse: text.substring(0, 1000) // Store partial response for debugging
    };
  } catch (error) {
    console.error("Error parsing estate document with Gemini:", error);
    
    // Return a basic structure on error
    return {
      summary: "Document uploaded but could not be parsed automatically",
      error: (error as Error).message,
      recommendations: ["Manual review of document recommended"]
    };
  }
}

// Temporary simple version for testing
async function parseEstateDocumentSimple(
  pdfBuffer: Buffer,
  documentType: string
): Promise<any> {
  console.log('Simple parse called:', { bufferSize: pdfBuffer.length, documentType });
  
  // Just return a basic response for now
  return {
    summary: `Test ${documentType} document uploaded successfully`,
    executionDate: "2024-01-01",
    preparedBy: "Test Attorney",
    recommendations: ["This is a test response - document parsing will be enabled soon"],
    testMode: true
  };
}

// Process uploaded documents for chat
async function processUploadedDocument(file: Express.Multer.File, userId: number, messageId: number): Promise<any> {
  try {
    console.log(`Processing document: ${file.originalname} (${file.mimetype})`);
    
    // Create unique file name
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const fileName = `${userId}_${timestamp}_${Math.random().toString(36).substring(7)}${fileExtension}`;
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'chat-documents');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Save file to disk
    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, file.buffer);
    console.log(`File saved to: ${filePath}`);
    
    // Determine document type and category
    const { documentType, documentCategory } = classifyDocument(file.originalname, file.mimetype);
    console.log(`Document classified as: ${documentType} (${documentCategory})`);
    
    // Extract content based on file type
    const extractedContent = await extractDocumentContent(file.buffer, file.mimetype);
    console.log(`Content extracted: ${extractedContent.text?.substring(0, 100)}...`);
    
    // Generate AI analysis
    const aiAnalysis = await generateDocumentAIAnalysis(extractedContent, documentType, file.originalname);
    console.log(`AI analysis completed: ${aiAnalysis.summary?.substring(0, 100)}...`);
    
    // Save to database
    const document = await storage.createChatDocument({
      userId,
      messageId,
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath,
      processingStatus: 'completed',
      extractedText: extractedContent.text,
      extractedData: extractedContent.data,
      aiSummary: aiAnalysis.summary,
      aiInsights: aiAnalysis.insights,
      documentType,
      documentCategory,
      processedAt: new Date(),
    });
    
    return document;
  } catch (error) {
    console.error('Error processing uploaded document:', error);
    // Still create database record with error status
    const document = await storage.createChatDocument({
      userId,
      messageId,
      fileName: `error_${Date.now()}_${file.originalname}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath: '',
      processingStatus: 'failed',
      extractedText: null,
      extractedData: { error: (error as Error).message },
      aiSummary: `Failed to process ${file.originalname}`,
      aiInsights: { error: (error as Error).message },
      documentType: 'other',
      documentCategory: 'other',
    });
    
    return document;
  }
}

// Classify document type based on filename and MIME type
function classifyDocument(fileName: string, mimeType: string): { documentType: string; documentCategory: string } {
  const lowerFileName = fileName.toLowerCase();
  
  // Tax documents
  if (lowerFileName.includes('tax') || lowerFileName.includes('1040') || lowerFileName.includes('w2') || lowerFileName.includes('1099')) {
    return { documentType: 'tax_return', documentCategory: 'tax' };
  }
  
  // Financial statements
  if (lowerFileName.includes('statement') || lowerFileName.includes('bank') || lowerFileName.includes('account')) {
    return { documentType: 'financial_statement', documentCategory: 'personal_finance' };
  }
  
  // Investment documents
  if (lowerFileName.includes('portfolio') || lowerFileName.includes('investment') || lowerFileName.includes('401k') || lowerFileName.includes('ira')) {
    return { documentType: 'investment', documentCategory: 'investment' };
  }
  
  // Insurance documents
  if (lowerFileName.includes('insurance') || lowerFileName.includes('policy') || lowerFileName.includes('claim')) {
    return { documentType: 'insurance', documentCategory: 'insurance' };
  }
  
  // Image files
  if (mimeType.startsWith('image/')) {
    return { documentType: 'image', documentCategory: 'other' };
  }
  
  // Spreadsheets
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return { documentType: 'spreadsheet', documentCategory: 'personal_finance' };
  }
  
  return { documentType: 'other', documentCategory: 'other' };
}

// Extract content from various document types
async function extractDocumentContent(buffer: Buffer, mimeType: string): Promise<{ text: string | null; data: any | null }> {
  try {
    switch (mimeType) {
      case 'application/pdf':
        const pdfParse = await import('pdf-parse');
        const pdfData = await pdfParse.default(buffer);
        return { text: pdfData.text, data: { pages: pdfData.numpages } };
        
      case 'text/plain':
        return { text: buffer.toString('utf-8'), data: null };
        
      case 'text/csv':
        const csvText = buffer.toString('utf-8');
        const csvLines = csvText.split('\n').slice(0, 10); // First 10 lines
        return { text: csvLines.join('\n'), data: { totalLines: csvText.split('\n').length } };
        
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        // For Excel files, we'll extract basic info - in production you'd use a library like xlsx
        return { text: 'Excel spreadsheet content (parsing in progress)', data: { type: 'excel' } };
        
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // For Word files, we'll extract basic info - in production you'd use a library like mammoth
        return { text: 'Word document content (parsing in progress)', data: { type: 'word' } };
        
      default:
        if (mimeType.startsWith('image/')) {
          // For images, we'll use vision API later
          return { text: 'Image content (AI vision analysis pending)', data: { type: 'image', mimeType } };
        }
        return { text: null, data: null };
    }
  } catch (error) {
    console.error('Error extracting document content:', error);
    return { text: null, data: { error: (error as Error).message } };
  }
}

// Generate AI analysis of document content
async function generateDocumentAIAnalysis(content: { text: string | null; data: any | null }, documentType: string, fileName: string): Promise<{ summary: string; insights: any }> {
  try {
    console.log(`Starting AI analysis for ${fileName}`);
    
    if (!content.text || content.text.length < 10) {
      console.log(`Content too short for analysis: ${content.text?.length || 0} chars`);
      return {
        summary: `Uploaded ${fileName} - content analysis pending`,
        insights: { status: 'content_extraction_incomplete' }
      };
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.log('No Gemini API key found');
      return {
        summary: `Document ${fileName} uploaded successfully`,
        insights: { status: 'ai_analysis_unavailable' }
      };
    }
    
    console.log('Initializing Gemini AI...');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    const prompt = `You are a financial analyst reviewing a document for a financial planning client.

Document: ${fileName}
Type: ${documentType}
Content Preview: ${content.text.substring(0, 2000)}

Provide a concise analysis in JSON format:
{
  "summary": "2-3 sentence summary of the document's key financial information",
  "keyFinancialData": {
    "amounts": ["List any significant dollar amounts found"],
    "dates": ["List any important dates"],
    "accounts": ["List any account numbers or institutions mentioned"]
  },
  "recommendations": ["List 2-3 actionable recommendations based on this document"],
  "riskFactors": ["List any potential financial risks identified"],
  "relevanceToFinancialPlanning": "How this document relates to overall financial planning"
}`;

    console.log('Calling Gemini API...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log(`AI response received: ${text.substring(0, 100)}...`);
    
    try {
      const analysis = JSON.parse(text);
      console.log('Successfully parsed AI response as JSON');
      return {
        summary: analysis.summary || `Analysis of ${fileName}`,
        insights: analysis
      };
    } catch (parseError) {
      console.log('Failed to parse AI response as JSON, using raw text');
      return {
        summary: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        insights: { rawResponse: text }
      };
    }
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    return {
      summary: `Document ${fileName} uploaded - analysis in progress`,
      insights: { error: (error as Error).message }
    };
  }
}

// Generate AI response with document context
async function generateEnhancedAIResponseWithDocuments(
  userMessage: string,
  userId: number,
  documentContext: Array<{
    fileName: string;
    type: string;
    summary: string;
    extractedText?: string;
  }>
): Promise<string> {
  try {
    // Get user's comprehensive financial context
    const userContext = await buildComprehensiveUserContext(userId);
    
    // Build enhanced prompt with document context
    const documentInfo = documentContext.map(doc => 
      `- ${doc.fileName} (${doc.type}): ${doc.summary}`
    ).join('\n');
    
    const enhancedMessage = `User has uploaded documents and asks: "${userMessage}"

Uploaded Documents:
${documentInfo}

Please provide personalized financial advice considering both the uploaded documents and the user's financial profile. Be specific about how the documents relate to their financial situation and goals.`;

    return await generateEnhancedAIResponse(enhancedMessage, userId);
  } catch (error) {
    console.error('Error generating AI response with documents:', error);
    return "I've received your documents and I'm analyzing them. The document upload was successful, but I'm having trouble generating a detailed analysis right now. Please try asking a specific question about your documents.";
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded assets (e.g., branding logos)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Setup authentication routes
  setupAuth(app);

  // Setup invite and advisor routes (before acting-as swap)
  setupInviteRoutes(app);
  setupAdvisorRoutes(app);
  setupReportRoutes(app);
  
  // Setup Plaid integration routes
  app.use('/api/plaid', plaidRoutes);
  
  // Setup notification routes
  app.use('/api', notificationRoutes);
  app.use('/api/wills', willsRoutes);
  app.use('/', retirementCalculationRoutes);

  // Acting-as middleware (ensures advisor can view client data across existing routes)
  setupActingAsMiddleware(app);

  // Setup achievement routes
  setupAchievementRoutes(app);
  
  // Setup debt management routes
  setupDebtManagementRoutes(app);
  
  // Setup life goals routes
  setupLifeGoalsRoutes(app, storage);
  
  // Setup admin routes
  app.use("/api/admin", adminRoutes);
  
  // Setup self-employed routes
  app.use("/api/self-employed", selfEmployedRoutes);

  // Check self-employment eligibility for conditional tab display
  app.get("/api/check-self-employment-eligibility", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const [profile] = await db
        .select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, req.user!.id));

      if (!profile) {
        return res.json({ isSelfEmploymentEligible: false });
      }

      // Check if user or spouse is self-employed or business owner
      const userIsSelfEmployed = profile.employmentStatus === 'self-employed' || 
                                 profile.employmentStatus === 'business-owner';
      const spouseIsSelfEmployed = profile.spouseEmploymentStatus === 'self-employed' || 
                                   profile.spouseEmploymentStatus === 'business-owner';

      const isSelfEmploymentEligible = userIsSelfEmployed || spouseIsSelfEmployed;

      return res.json({ 
        isSelfEmploymentEligible,
        userEmploymentStatus: profile.employmentStatus,
        spouseEmploymentStatus: profile.spouseEmploymentStatus 
      });
    } catch (error) {
      console.error("Error checking self-employment eligibility:", error);
      return res.status(500).json({ error: "Failed to check eligibility" });
    }
  });

  // Helper: verbose logging
  const vlog = (...args: any[]) => { if (process.env.VERBOSE_LOGS === '1') console.log(...args); };
  
  // DEBUG ENDPOINT: Check and clear session state
  app.post("/api/debug/clear-session", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const actingAsClientId = (req.session as any).actingAsClientId;
    console.log('🔧 Session state before clear:', {
      userId: req.user!.id,
      userEmail: req.user?.email,
      actingAsClientId,
      sessionKeys: Object.keys(req.session || {})
    });
    
    // Clear any acting-as state
    delete (req.session as any).actingAsClientId;
    
    req.session.save(() => {
      console.log('✅ Session cleared successfully');
      res.json({ 
        cleared: true, 
        wasActingAs: !!actingAsClientId,
        clearedClientId: actingAsClientId,
        currentUserId: req.user!.id 
      });
    });
  });

  // Financial profile routes
  // Dashboard snapshot API (single payload for 9–10 widgets, cached by scenario hash)
  setupDashboardSnapshotRoutes(app);

  app.get("/api/financial-profile", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      // Check if client wants fresh calculations (dashboard widgets)
      const forceRefresh = req.query.refresh === 'true';
      const skipExpensiveOps = req.query.fast === 'true'; // Fast mode for initial dashboard load
      
      // Set headers to prevent caching
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });

      // Check if advisor is acting as client
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;
      
      // DEBUG: Log session state for troubleshooting
      if (actingAsClientId) {
        console.log('🔍 ACTING-AS DETECTED in financial-profile:', {
          realUserId: req.user!.id,
          realUserEmail: req.user?.email,
          actingAsClientId,
          userRole: req.user?.role,
          sessionKeys: Object.keys(req.session || {})
        });
      } else {
        console.log('✅ Normal user session in financial-profile:', { 
          userId: req.user!.id, 
          userEmail: req.user?.email,
          userRole: req.user?.role 
        });
      }
      
      // Check if Plaid sync is needed (only sync if data is stale)
      const shouldSyncPlaid = req.query.syncPlaid === 'true';
      
      if (shouldSyncPlaid) {
        // Only sync if explicitly requested (e.g., user clicks refresh button)
        try {
          const { PlaidIntakeDirectMapper } = await import('./services/plaid-intake-direct-mapper');
          // Run sync in background - don't wait for it
          PlaidIntakeDirectMapper.syncAllToProfile(userId)
            .then(() => console.log('Background Plaid sync completed for user:', userId))
            .catch(err => console.error('Background Plaid sync failed:', err));
          vlog('Started background Plaid sync');
        } catch (syncError) {
          console.log('Plaid sync skipped:', syncError.message);
        }
      } else {
        // Check last sync time from plaidSyncStatus table
        try {
          const { plaidSyncStatus } = await import('../shared/schema');
          const [lastSync] = await db.select()
            .from(plaidSyncStatus)
            .where(eq(plaidSyncStatus.userId, userId))
            .limit(1);
          
          const lastSyncedAtMs = lastSync?.lastSyncedAt ? new Date(lastSync.lastSyncedAt as any).getTime() : NaN;
          const hoursSinceSync = Number.isFinite(lastSyncedAtMs)
            ? (Date.now() - (lastSyncedAtMs as number)) / (1000 * 60 * 60)
            : 999;
          
          // Only auto-sync if data is older than 24 hours
          if (hoursSinceSync > 24) {
            vlog(`Plaid data is ${hoursSinceSync.toFixed(1)} hours old, triggering background sync`);
            const { PlaidIntakeDirectMapper } = await import('./services/plaid-intake-direct-mapper');
            // Run in background - don't wait
            PlaidIntakeDirectMapper.syncAllToProfile(userId)
              .then(() => vlog('Background auto-sync completed'))
              .catch(err => console.error('Background auto-sync failed:', err));
          } else {
            vlog(`Plaid data is fresh (${hoursSinceSync.toFixed(1)} hours old), skipping sync`);
          }
        } catch (err) {
          console.log('Could not check Plaid sync status:', err.message);
        }
      }
      
      const profile = await storage.getFinancialProfile(userId);

      if (profile) {
        vlog('Fetched financial profile for user:', req.user!.id);
        vlog('Spouse 401k assets:', profile.assets?.filter((a: any) => 
          a.type?.toLowerCase() === '401k' && a.owner?.toLowerCase() === 'spouse'
        ));
        
        // Check if we have recent persisted calculations
        const hasPersistedCalculations = profile.calculations && 
          typeof profile.calculations === 'object' &&
          Object.keys(profile.calculations).length > 0;
        
        let calculations;
        
        if (skipExpensiveOps && !hasPersistedCalculations) {
          // FAST mode: return minimal profile without triggering heavy recomputation
          return res.json({
            ...profile,
            calculations: profile.calculations || undefined,
          });
        }

        if (hasPersistedCalculations && !forceRefresh) {
          // Use persisted calculations - this is the primary path for dashboard loads
          vlog('Using persisted calculations from database for dashboard');
          calculations = profile.calculations;
          vlog('Using persisted spouse risk data:', {
            spouseRiskProfile: (calculations as any).spouseRiskProfile,
            spouseRiskScore: (calculations as any).spouseRiskScore,
            spouseTargetAllocation: (calculations as any).spouseTargetAllocation
          });
          vlog('Using persisted Optimal Retirement Age data:', (calculations as any).optimalRetirementAge);
        } else {
          // Only recalculate if no persisted calculations exist (e.g., old profiles) or refresh is forced
          if (forceRefresh) {
            vlog('[Dashboard] Force refresh requested - calculating fresh financial metrics');
          } else {
            vlog('No persisted calculations found - calculating fresh financial metrics');
          }
          vlog('Profile data for calculations:', {
            maritalStatus: profile.maritalStatus,
            hasSpouseRiskQuestions: !!profile.spouseRiskQuestions,
            spouseRiskQuestions: profile.spouseRiskQuestions
          });
          
          // Get estate documents for recommendations
          const estateDocuments = await storage.getEstateDocuments(req.user!.id);
          
          // Use enhanced calculations with Plaid data
          calculations = await calculateFinancialMetricsWithPlaid(profile, estateDocuments, userId);
          // Stamp when these calculations were produced so the UI can show freshness
          try {
            (calculations as any).calculatedAt = new Date().toISOString();
          } catch {}
          console.log('Calculated fresh spouse risk data:', {
            spouseRiskProfile: calculations.spouseRiskProfile,
            spouseRiskScore: calculations.spouseRiskScore,
            spouseTargetAllocation: calculations.spouseTargetAllocation
          });
          console.log('Fresh Optimal Retirement Age data:', calculations.optimalRetirementAge);
          
        // Save the newly calculated data for future use
        try {
          await storage.updateFinancialProfile(userId, {
            calculations,
            financialHealthScore: Math.round(Number(calculations?.healthScore) || 0),
            emergencyReadinessScore: Math.round(Number(calculations?.emergencyScore) || 0),
            retirementReadinessScore: Math.round(Number(calculations?.retirementScore) || 0),
            riskManagementScore: Math.round(Number(calculations?.insuranceScore) || 0),
            cashFlowScore: Math.round(Number(calculations?.cashFlowScore) || 0),
            monthlyCashFlow: (typeof calculations?.monthlyCashFlow === 'number') ? calculations.monthlyCashFlow : null,
            monthlyCashFlowAfterContributions: (typeof calculations?.monthlyCashFlowAfterContributions === 'number') ? calculations.monthlyCashFlowAfterContributions : null
          });
          console.log('Saved fresh calculations to database for future use');
        } catch (saveError) {
          console.error('Error saving fresh calculations to database:', saveError);
          // Continue without failing - this is just for future optimization
        }

        // When refresh=true, force fresh Monte Carlo (score + bands) to keep dashboard in sync
        try {
          console.log('[Dashboard Refresh] Recomputing Monte Carlo (score + bands)');
          const freshProfile = await storage.getFinancialProfile(userId);
          if (freshProfile) {
            const { profileToRetirementParams } = await import('./monte-carlo-base');
            const { mcPool } = await import('./services/mc-pool');

            const params = profileToRetirementParams(freshProfile as any);
            (params as any).useNominalDollars = true;
            (params as any).displayInTodaysDollars = true;

            // Compute score
            const scoreRes: any = await mcPool.run({ type: 'score', params, simulationCount: 1000 });
            const successes = scoreRes.successes || 0;
            const total = scoreRes.total || 1000;
            const probabilityDecimal = total > 0 ? (successes / total) : 0;
            const medianEndingBalance = Math.round(scoreRes.medianEndingBalance || 0);
            const percentile10 = Math.round(scoreRes.percentile10 || 0);
            const percentile90 = Math.round(scoreRes.percentile90 || 0);

            // Compute bands
            const bandsRes: any = await mcPool.run({ type: 'bands', params, simulationCount: 1000 });
            const perYear = bandsRes.perYear || {};
            const years = Object.keys(perYear).map((k) => parseInt(k, 10)).sort((a, b) => a - b);
            const ages = years.map((i) => perYear[i]?.age || ((params as any).currentAge || 30) + i);
            const p25 = years.map((i) => perYear[i]?.p25 || 0);
            const p50 = years.map((i) => perYear[i]?.p50 || 0);
            const p75 = years.map((i) => perYear[i]?.p75 || 0);

            await storage.updateFinancialProfile(userId, {
              monteCarloSimulation: {
                retirementSimulation: {
                  calculatedAt: new Date().toISOString(),
                  parameters: params,
                  results: {
                    successProbability: probabilityDecimal,
                    probabilityOfSuccess: probabilityDecimal,
                    totalScenarios: total,
                    successfulScenarios: Math.round(probabilityDecimal * total),
                    medianFinalValue: medianEndingBalance,
                    percentile10,
                    percentile90,
                  },
                },
                probabilityOfSuccess: probabilityDecimal,
                medianEndingBalance,
                retirementConfidenceBands: {
                  ages,
                  percentiles: { p25, p50, p75 },
                  meta: {
                    currentAge: params.currentAge,
                    retirementAge: params.retirementAge,
                    longevityAge: params.currentAge + (ages.length ? ages.length - 1 : 0),
                    runs: 1000,
                    calculatedAt: new Date().toISOString(),
                  },
                },
              },
            } as any);
            console.log('[Dashboard Refresh] Monte Carlo recomputed and saved');
          }
        } catch (mcErr) {
          console.error('[Dashboard Refresh] Monte Carlo recomputation failed:', (mcErr as any)?.message || mcErr);
        }
        }
        
        // Generate lightweight net worth projections if missing but Monte Carlo data exists
        let fillProjections = null;
        if (!profile.netWorthProjections?.projectionData && 
            profile.monteCarloSimulation?.retirementSimulation?.results?.yearlyCashFlows?.length > 0) {
          console.log('GET: Generating lightweight projections from saved Monte Carlo summary');
          
          try {
            const currentYear = new Date().getFullYear();
            const currentAge = profile.currentAge || 50;
            const retirementAge = profile.desiredRetirementAge || 65;
            const longevityAge = 93;
            
            // Get saved yearlyCashFlows (median scenario)
            const yearlyCashFlows = profile.monteCarloSimulation.retirementSimulation.results.yearlyCashFlows;
            
            // Calculate real estate and debt projections
            const homeValue = profile.primaryResidence?.marketValue || 0;
            const additionalRealEstate = (profile.assets || [])
              .filter((asset: any) => asset.type === 'real-estate')
              .reduce((sum: number, asset: any) => sum + (asset.value || 0), 0);
            const totalRealEstateValue = homeValue + additionalRealEstate;
            
            const totalMortgage = (profile.primaryResidence?.mortgageBalance || 0);
            const monthlyMortgagePayment = (profile.primaryResidence?.monthlyPayment || 0);
            const nominalRealEstateGrowth = 0.043; // 4.3% annual growth
            
            // Build projection data
            const projectionData = yearlyCashFlows.slice(0, longevityAge - currentAge + 1).map((yearData: any, index: number) => {
              const age = currentAge + index;
              const year = currentYear + index;
              const yearsFromNow = index;
              
              // Real estate growth
              const realEstateValue = totalRealEstateValue * Math.pow(1 + nominalRealEstateGrowth, yearsFromNow);
              
              // Mortgage reduction (simplified)
              const remainingMortgage = Math.max(0, totalMortgage - (monthlyMortgagePayment * yearsFromNow * 12 * 0.4));
              const netRealEstate = Math.max(0, realEstateValue - remainingMortgage);
              
              // Portfolio value from Monte Carlo
              const retirementAssets = yearData.portfolioValue || 0;
              
              return {
                year,
                age,
                retirementAssets,
                realEstate: netRealEstate,
                debt: remainingMortgage,
                totalNetWorth: retirementAssets + netRealEstate
              };
            });
            
            // Calculate key metrics
            const retirementData = projectionData.find(d => d.age === retirementAge) || projectionData[0];
            const longevityData = projectionData.find(d => d.age === longevityAge) || projectionData[projectionData.length - 1];
            
            fillProjections = {
              projectionData,
              netWorthAtRetirement: retirementData?.totalNetWorth || 0,
              netWorthAtLongevity: longevityData?.totalNetWorth || 0,
              currentAge,
              retirementAge,
              longevityAge
            };
            
            console.log('GET: Generated projections with retirement net worth:', retirementData?.totalNetWorth);
          } catch (error) {
            console.error('Error generating lightweight projections:', error);
          }
        }
        
        const profileWithCalculations = {
          ...profile,
          calculations,
          // Add lightweight projections if generated (without persisting to DB)
          ...(fillProjections ? { netWorthProjections: fillProjections } : {}),
          // Only sync top-level fields if we used fresh calculations (preserve persisted values otherwise)
          ...(hasPersistedCalculations ? {} : {
            financialHealthScore: Math.round(calculations.financialHealthScore ?? calculations.financialScore ?? 0),
            emergencyReadinessScore: Math.round(calculations.emergencyScore ?? 0),
            retirementReadinessScore: Math.round(calculations.retirementScore ?? 0),
            riskManagementScore: Math.round(calculations.insuranceAdequacy?.score ?? calculations.insuranceScore ?? 0)
          })
        };
        res.json(profileWithCalculations);
      } else {
        res.json(null);
      }
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/financial-profile", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const realUser = (req as any).realUser;
      const isAdvisorActing = realUser && realUser.role === 'advisor' && realUser.id !== req.user!.id;
      // Respect advisor acting-as: target the client profile for all reads/writes
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const targetUserId = actingAsClientId || req.user!.id;
      const beforeProfile = await storage.getFinancialProfile(targetUserId);

      // Log all incoming field names only when verbose
      vlog('Incoming request body keys:', Object.keys(req.body));
      vlog('hasLongTermCareInsurance value received:', req.body.hasLongTermCareInsurance);
      
      // Debug income values
      vlog('=== INCOMING INCOME DATA ===');
      vlog('annualIncome:', req.body.annualIncome);
      vlog('takeHomeIncome:', req.body.takeHomeIncome);
      vlog('spouseAnnualIncome:', req.body.spouseAnnualIncome);
      vlog('spouseTakeHomeIncome:', req.body.spouseTakeHomeIncome);
      vlog('otherIncome:', req.body.otherIncome);
      vlog('employmentStatus:', req.body.employmentStatus);
      vlog('spouseEmploymentStatus:', req.body.spouseEmploymentStatus);
      vlog('=== END INCOMING INCOME DATA ===');
      const problematicKeys = Object.keys(req.body).filter(key => key.includes('-'));
      if (problematicKeys.length > 0) console.error('Found keys with hyphens:', problematicKeys);

      // Skip heavy calculations for partial saves and optimization-only updates
      const isOptimizationOnlyUpdate = Object.keys(req.body || {}).every((k) =>
        k === 'optimizationVariables' ||
        k === 'retirementPlanningUIPreferences' ||
        k === 'skipCalculations' ||
        k === 'isPartialSave' ||
        k === 'currentStep'
      );
      const skipCalculations = req.body.skipCalculations || req.body.isPartialSave || isOptimizationOnlyUpdate;
      
      // Calculate comprehensive financial metrics only if not skipping
      let calculations;
      if (skipCalculations) {
        console.log('Skipping calculations for partial save - step', req.body.currentStep);
        // Use existing calculations if available, otherwise minimal defaults
        const existingProfile = await storage.getFinancialProfile(targetUserId);
        calculations = existingProfile?.calculations || {
          healthScore: 0,
          breakdown: {},
          recommendations: []
        };
      } else {
        // ✅ ALWAYS DO FRESH CALCULATIONS ON INTAKE FORM RESUBMISSION
        console.log('🔥 INTAKE FORM RESUBMISSION - Forcing fresh calculations (no old data mixing)');
        try {
          // Use FAST calculations only (no Monte Carlo) for intake form submission
          calculations = await calculateFastFinancialMetrics(req.body, targetUserId);
          console.log('Calculated FRESH financial metrics:', {
            healthScore: calculations.healthScore,
            breakdown: calculations.breakdown,
            spouseRiskProfile: calculations.spouseRiskProfile,
            spouseRiskScore: calculations.spouseRiskScore,
            spouseTargetAllocation: calculations.spouseTargetAllocation
          });
        } catch (calcError) {
          console.error('Error calculating financial metrics:', calcError);
          return res.status(500).json({ 
            message: "Error calculating financial metrics", 
            details: calcError instanceof Error ? calcError.message : String(calcError) 
          });
        }
      }
      
      vlog('Incoming profile data:', {
        maritalStatus: req.body.maritalStatus,
        hasSpouseRiskQuestions: !!req.body.spouseRiskQuestions,
        spouseRiskQuestionsLength: req.body.spouseRiskQuestions?.length,
        spouseRiskQuestions: req.body.spouseRiskQuestions
      });

      // Extract hasLongTermCareInsurance from the request body
      const hasLongTermCareInsurance = Boolean(req.body.hasLongTermCareInsurance);
      
      // Calculate optimal Social Security ages using lifetime cash flow analysis
      let optimalSSData = null;
      
      if (!skipCalculations && process.env.CALCS_ASYNC !== '1') {
        console.log('🔍 INTAKE FORM SUBMISSION - Starting SS optimization check...');
        console.log('📊 Profile data summary:', {
          hasDateOfBirth: !!req.body.dateOfBirth,
          hasAnnualIncome: !!req.body.annualIncome,
          hasSocialSecurityBenefit: !!req.body.socialSecurityBenefit,
          maritalStatus: req.body.maritalStatus,
          hasAssets: !!(req.body.assets && req.body.assets.length > 0),
          hasRetirementAge: !!req.body.desiredRetirementAge
        });
        
        try {
          const { LifetimeCashFlowOptimizer } = await import("./lifetime-cashflow-optimizer");
          
          console.log('🧮 Running lifetime cash flow optimization...');
          const cashFlowResult = LifetimeCashFlowOptimizer.calculateOptimalAgesFromProfile(req.body);
          
          if (cashFlowResult) {
            optimalSSData = {
              optimalSocialSecurityAge: cashFlowResult.optimalUserAge,
              optimalSpouseSocialSecurityAge: cashFlowResult.optimalSpouseAge,
              lifetimeCashFlow: cashFlowResult.totalLifetimeCashFlow,
              calculatedAt: new Date().toISOString(),
              methodology: 'lifetime_cashflow_analysis',
              alternativeScenarios: cashFlowResult.alternativeScenarios.slice(0, 5) // Top 5 scenarios
            };
            
            console.log('✅ SUCCESS: Optimal SS ages calculated!', {
              primary: optimalSSData.optimalSocialSecurityAge,
              spouse: optimalSSData.optimalSpouseSocialSecurityAge,
              lifetimeCashFlow: `$${Math.round(optimalSSData.lifetimeCashFlow).toLocaleString()}`
            });
          } else {
            console.log('❌ FAILED: No optimization result returned');
            console.log('🔍 This usually means insufficient data for calculation');
          }
        } catch (ssError) {
          console.error('❌ ERROR: Exception during SS optimization:', ssError);
          console.error('📋 Error details:', {
            name: ssError.name,
            message: ssError.message,
            stack: ssError.stack?.substring(0, 200)
          });
        }
      } else {
        console.log('Skipping SS optimization for partial save');
        // Preserve existing SS data if available
        const existingProfile = await storage.getFinancialProfile(targetUserId);
        if (existingProfile?.optimalSocialSecurityAge) {
          optimalSSData = {
            optimalSocialSecurityAge: existingProfile.optimalSocialSecurityAge,
            optimalSpouseSocialSecurityAge: existingProfile.optimalSpouseSocialSecurityAge,
            socialSecurityOptimization: existingProfile.socialSecurityOptimization
          };
        }
      }

      // Get existing profile to preserve scores during partial saves
      const existingProfile = await storage.getFinancialProfile(targetUserId);

      // Store the profile data with calculations and optimal SS data
      const profileData = {
        ...req.body,
        calculations,
        // ✅ FRESH DATA ONLY - Store financial health score as separate field for easy retrieval
        financialHealthScore: skipCalculations ? 
          (existingProfile?.financialHealthScore ?? 0) : 
          Math.round(Number(calculations?.healthScore) || 0),
        // ✅ FRESH DATA ONLY - Store other scores separately for dashboard 
        emergencyReadinessScore: skipCalculations ? 
          (existingProfile?.emergencyReadinessScore ?? 0) : 
          Math.round(Number(calculations?.emergencyScore) || 0),
        retirementReadinessScore: skipCalculations ? 
          (existingProfile?.retirementReadinessScore ?? 0) : 
          Math.round(Number(calculations?.retirementScore) || 0),
        riskManagementScore: skipCalculations ? 
          (existingProfile?.riskManagementScore ?? 0) : 
          Math.round(Number(calculations?.insuranceScore) || 0),
        cashFlowScore: skipCalculations ? 
          (existingProfile?.cashFlowScore ?? 0) : 
          Math.round(Number(calculations?.cashFlowScore) || 0),
        // ✅ FRESH DATA ONLY - Net worth projections will be recalculated fresh below (no preservation)
        // Removed: ...(skipCalculations && existingProfile?.netWorthProjections ? { netWorthProjections: existingProfile.netWorthProjections } : {}),
        // ✅ FRESH DATA ONLY - Store core financial metrics for dashboard widgets
        netWorth: calculations?.netWorth || 0,
        monthlyCashFlow: calculations?.monthlyCashFlow || 0,
        monthlyCashFlowAfterContributions: calculations?.monthlyCashFlowAfterContributions || 0,
        // ✅ FRESH DATA ONLY - Store risk profiles and allocations for Investment Profile widgets
        userRiskProfile: calculations?.riskProfile || 'Not Assessed',
        targetAllocation: calculations?.targetAllocation || {},
        spouseRiskProfile: calculations?.spouseRiskProfile || 'Not Assessed',
        spouseTargetAllocation: calculations?.spouseTargetAllocation || {},
        // Transfer Plaid allocation data to individual fields for Gemini API (fallback to intake currentAllocation)
        currentStockAllocation: (calculations?.allocation?.stocks ??
          ((calculations?.allocation?.usStocks || 0) + (calculations?.allocation?.intlStocks || 0))) ||
          (req.body.currentAllocation?.stocks ??
            ((req.body.currentAllocation?.usStocks || 0) + (req.body.currentAllocation?.intlStocks || 0))) || 0,
        currentBondAllocation: (calculations?.allocation?.bonds ??
          (req.body.currentAllocation?.bonds || 0)),
        currentCashAllocation: (calculations?.allocation?.cash ??
          (req.body.currentAllocation?.cash || 0)),
        currentAlternativesAllocation: (calculations?.allocation?.alternatives ??
          (req.body.currentAllocation?.alternatives || 0)),
        // Ensure hasLongTermCareInsurance is explicitly set
        hasLongTermCareInsurance,
        // Self-employment flags derived from intake
        isSelfEmployed: req.body.employmentStatus === 'self-employed' || req.body.employmentStatus === 'business-owner',
        // Retirement plan flag inferred from assets
        hasRetirementPlan: Array.isArray(req.body.assets) ? req.body.assets.some((asset: any) => {
          const type = asset?.type?.toString()?.toLowerCase() || '';
          return type.includes('401k') || type.includes('403b') || type.includes('ira') || type.includes('pension') || type.includes('retirement');
        }) : false,
        // Add optimal Social Security data if calculated
        ...(optimalSSData && {
          optimalSocialSecurityAge: optimalSSData.optimalSocialSecurityAge,
          optimalSpouseSocialSecurityAge: optimalSSData.optimalSpouseSocialSecurityAge,
          socialSecurityOptimization: optimalSSData
        })
      };

      let profile;
      try {
        profile = await storage.updateFinancialProfile(
          targetUserId,
          profileData,
        );

        console.log('Saved profile with calculations:', {
          hasCalculations: !!profile.calculations,
          healthScore: (profile.calculations as any)?.healthScore,
          breakdown: (profile.calculations as any)?.breakdown,
          spouseRiskProfile: (profile.calculations as any)?.spouseRiskProfile,
          spouseRiskScore: (profile.calculations as any)?.spouseRiskScore,
          hasSpouseRiskQuestions: !!profile.spouseRiskQuestions,
          spouseRiskQuestionsFromProfile: profile.spouseRiskQuestions,
          hasLongTermCareInsurance: profile.hasLongTermCareInsurance
        });
      } catch (dbError) {
        console.error('Error updating financial profile in database:', dbError);
        return res.status(500).json({ 
          message: "Error saving financial profile", 
          details: dbError instanceof Error ? dbError.message : String(dbError) 
        });
      }

      // Trigger Monte Carlo calculation after successful profile save (only for full calculations)
      if (!skipCalculations && process.env.CALCS_ASYNC !== '1') {
        try {
          console.log('Triggering Monte Carlo calculation after profile update...');
          const params = profileToRetirementParams(profile);
          const mcResult = await mcPool.run({ params, simulationCount: 1000, type: 'score' });
          const enhanced = mcResult.fullResult;

          // Store Monte Carlo results (compact form for DB)
          const scenarios = enhanced.scenarios || { successful: Math.round(enhanced.probabilityOfSuccess * 1000), failed: 0, total: 1000 };
          const monteCarloData = {
            retirementSimulation: {
              calculatedAt: new Date().toISOString(),
              parameters: params,
              results: {
                successProbability: enhanced.probabilityOfSuccess,
                probabilityOfSuccess: Math.round(enhanced.probabilityOfSuccess * 1000) / 1000,
                totalScenarios: scenarios.total,
                successfulScenarios: scenarios.successful,
                medianFinalValue: enhanced.medianEndingBalance || 0,
                percentile10: enhanced.confidenceIntervals?.percentile10 || 0,
                percentile90: enhanced.confidenceIntervals?.percentile90 || 0,
                averageDeficit: 0,
                averageSurplus: 0,
                yearlyCashFlows: []
              }
            },
            probabilityOfSuccess: enhanced.probabilityOfSuccess,
            medianEndingBalance: enhanced.medianEndingBalance
          };

          await storage.updateFinancialProfile(targetUserId, {
            monteCarloSimulation: monteCarloData
          });

          console.log('Monte Carlo calculation completed and saved:', {
            probabilityOfSuccess: enhanced.probabilityOfSuccess,
            medianEndingBalance: enhanced.medianEndingBalance
          });
        } catch (monteCarloError) {
          // Don't fail the profile update if Monte Carlo fails
          console.error('Error calculating Monte Carlo after profile update:', monteCarloError);
        }
      } else {
        console.log('Skipping Monte Carlo calculation for partial save');
      }

      
      // DISABLED: Automatic Gemini insights generation to save resources
      // Insights are now ONLY generated when user clicks button on dashboard
      if (!skipCalculations && process.env.CALCS_ASYNC !== '1') {
        // Skip automatic insights generation
        console.log('📌 Skipping automatic Gemini insights - generate on-demand via dashboard button');
        /* DISABLED TO SAVE RESOURCES
        try {
          console.log('🔥 INTAKE FORM RESUBMISSION - Forcing fresh Gemini insights generation...');
          const { generateGeminiInsights, createProfileDataHash } = await import('./gemini-insights');
          
          // Get estate documents for comprehensive analysis
          const estateDocuments = await storage.getEstateDocuments(req.user!.id);
          
          // ✅ ALWAYS REGENERATE INSIGHTS ON INTAKE FORM RESUBMISSION (no hash checking)
          console.log('🔥 FORCING fresh insights generation - intake form resubmission detected');
          
          // Debug: Log allocation data before generating insights
          console.log('🔍 Fresh allocation data for Gemini insights:');
          console.log('  req.body.currentAllocation:', req.body.currentAllocation);
          console.log('  FRESH calculations.allocation:', calculations?.allocation);
          console.log('  FRESH profileData.currentStockAllocation:', profileData.currentStockAllocation);
          console.log('  FRESH profileData.currentBondAllocation:', profileData.currentBondAllocation);
          console.log('  FRESH profileData.currentCashAllocation:', profileData.currentCashAllocation);
          console.log('  FRESH profileData.currentAllocation:', profileData.currentAllocation);

          // ✅ Generate completely fresh insights using ONLY fresh data
          const insightsResult = await generateGeminiInsights(
            profileData,  // Fresh profile data
            calculations, // Fresh calculations
            estateDocuments // Estate docs (unchanged)
          );
          
          // ✅ Save completely fresh insights to database
        await storage.createDashboardInsights(targetUserId, {
            insights: insightsResult.insights,
            generatedByModel: "gemini-2.5-flash-lite",
            generationPrompt: insightsResult.generationPrompt,
            generationVersion: "1.0",
            financialSnapshot: insightsResult.financialSnapshot,
            profileDataHash: insightsResult.profileDataHash,
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          });
          
          console.log(`✅ Generated and saved ${insightsResult.insights.length} COMPLETELY FRESH insights from resubmitted intake form`);
        } catch (insightsError) {
          console.error('Failed to generate fresh insights after intake form resubmission:', insightsError);
          // Don't fail the entire profile update if insights generation fails
        }
        */ // END DISABLED BLOCK
      } else {
        console.log('⏭️ Skipping insights generation for partial save');
      }

      // Advisor audit log if acting-as
      try {
        if (isAdvisorActing) {
          await storage.createAdvisorAuditLog({
            actorAdvisorId: realUser.id,
            clientId: req.user!.id,
            entity: 'financial_profile',
            entityId: (beforeProfile as any)?.id || null,
            action: beforeProfile ? 'update' : 'create',
            before: beforeProfile || null,
            after: profile || null,
          } as any);
        }
      } catch (e) {
        console.error('Failed to create advisor audit log:', e);
      }

      // Invalidate all widget caches and kick off heavy recalculations so dashboard shows fresh data
      try {
        // Redis-backed widget cache (if enabled)
        const { widgetCacheManager: redisWidgetCache } = await import('./services/widget-cache-manager');
        await redisWidgetCache.invalidateUserCache(targetUserId);
      } catch (e) {
        console.log('[ProfileSave] Redis widget cache invalidation skipped or failed:', (e as any)?.message);
      }
      // Invalidate generic cache namespaces (includes dashboard snapshots)
      try {
        const { cacheService: genericCache } = await import('./services/cache.service');
        await genericCache.invalidateUser(targetUserId);
      } catch (e) {
        console.log('[ProfileSave] Generic cache invalidation skipped or failed:', (e as any)?.message);
      }
      try {
        // DB-backed widget cache (legacy path used by some jobs)
        const { widgetCacheManager: dbWidgetCache } = await import('./widget-cache-manager');
        await dbWidgetCache.invalidateAllUserCache(targetUserId);
      } catch (e) {
        console.log('[ProfileSave] DB widget cache invalidation skipped or failed:', (e as any)?.message);
      }

      // Recalculate light-but-important projections inline for immediate dashboard freshness
      if (!skipCalculations) {
        try {
          const { calculateNetWorthProjections } = await import('./net-worth-projections');
          const freshProfile = await storage.getFinancialProfile(targetUserId);
          if (freshProfile) {
            const proj = calculateNetWorthProjections(freshProfile);
            await storage.updateFinancialProfile(targetUserId, {
              netWorthProjections: {
                calculatedAt: new Date().toISOString(),
                projectionData: proj.projectionData,
                netWorthAtRetirement: proj.netWorthAtRetirement,
                netWorthAtLongevity: proj.netWorthAtLongevity,
                currentAge: proj.currentAge,
                retirementAge: proj.retirementAge,
                longevityAge: proj.longevityAge,
                parameters: {
                  homeValue: freshProfile.primaryResidence?.marketValue || 0,
                  mortgageBalance: freshProfile.primaryResidence?.mortgageBalance || 0,
                  realEstateGrowthRate: 0.043,
                }
              }
            });
          }
        } catch (e) {
          console.log('[ProfileSave] Net worth projections inline calc failed:', (e as any)?.message);
        }

        // Inline Monte Carlo recomputation on full resubmission (score + bands)
        try {
          console.log('[Intake Resubmission] Recomputing Monte Carlo (score + bands)');
          const freshProfile2 = await storage.getFinancialProfile(targetUserId);
          if (freshProfile2) {
            const { profileToRetirementParams } = await import('./monte-carlo-base');
            const { mcPool } = await import('./services/mc-pool');
            const params = profileToRetirementParams(freshProfile2 as any);
            (params as any).useNominalDollars = true;
            (params as any).displayInTodaysDollars = true;

            const scoreRes: any = await mcPool.run({ type: 'score', params, simulationCount: 1000 });
            const successes = scoreRes.successes || 0;
            const total = scoreRes.total || 1000;
            const probabilityDecimal = total > 0 ? (successes / total) : 0;
            const medianEndingBalance = Math.round(scoreRes.medianEndingBalance || 0);
            const percentile10 = Math.round(scoreRes.percentile10 || 0);
            const percentile90 = Math.round(scoreRes.percentile90 || 0);

            const bandsRes: any = await mcPool.run({ type: 'bands', params, simulationCount: 1000 });
            const perYear = bandsRes.perYear || {};
            const years = Object.keys(perYear).map((k) => parseInt(k, 10)).sort((a, b) => a - b);
            const ages = years.map((i) => perYear[i]?.age || ((params as any).currentAge || 30) + i);
            const p05 = years.map((i) => perYear[i]?.p05 || 0);
            const p25 = years.map((i) => perYear[i]?.p25 || 0);
            const p50 = years.map((i) => perYear[i]?.p50 || 0);
            const p75 = years.map((i) => perYear[i]?.p75 || 0);
            const p95 = years.map((i) => perYear[i]?.p95 || 0);

            await storage.updateFinancialProfile(targetUserId, {
              monteCarloSimulation: {
                retirementSimulation: {
                  calculatedAt: new Date().toISOString(),
                  parameters: params,
                  results: {
                    successProbability: probabilityDecimal,
                    probabilityOfSuccess: probabilityDecimal,
                    totalScenarios: total,
                    successfulScenarios: Math.round(probabilityDecimal * total),
                    medianFinalValue: medianEndingBalance,
                    percentile10,
                    percentile90,
                  },
                },
                probabilityOfSuccess: probabilityDecimal,
                medianEndingBalance,
                retirementConfidenceBands: {
                  ages,
                  percentiles: { p05, p25, p50, p75, p95 },
                  meta: {
                    currentAge: params.currentAge,
                    retirementAge: params.retirementAge,
                    longevityAge: params.currentAge + (ages.length ? ages.length - 1 : 0),
                    runs: 1000,
                    calculatedAt: new Date().toISOString(),
                  },
                },
              },
            } as any);
            console.log('[Intake Resubmission] Monte Carlo recomputed and saved');
          }
        } catch (mcErr) {
          console.error('[Intake Resubmission] Monte Carlo recomputation failed:', (mcErr as any)?.message || mcErr);
        }

        // Enqueue for any additional heavy jobs (optional)
        enqueuePostProfileCalcs(targetUserId);
      }

      // If async mode explicitly enabled, return a queued flag for the client
      if (!skipCalculations && process.env.CALCS_ASYNC === '1') {
        return res.json({ ...profile, calculationQueued: true });
      }

      res.json(profile);
    } catch (error) {
      console.error('Error in PUT /api/financial-profile:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestBody: req.body ? Object.keys(req.body) : 'no body'
      });
      
      // Send a more informative error response
      if (error instanceof Error) {
        res.status(500).json({ 
          message: "Error saving financial profile", 
          details: error.message,
          type: error.name
        });
      } else {
        res.status(500).json({ 
          message: "Error saving financial profile", 
          details: String(error) 
        });
      }
    }
  });

  // Dashboard Insights endpoint
  app.get("/api/dashboard-insights", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      
      // Get current insights
      const insights = await storage.getDashboardInsights(userId);
      
      if (!insights) {
        // No insights exist - try to generate them
        try {
          console.log('No existing insights found - generating initial insights...');
          const { generateGeminiInsights, createProfileDataHash } = await import('./gemini-insights');
          
          const profile = await storage.getFinancialProfile(userId);
          console.log('Profile for insights:', {
            hasProfile: !!profile,
            hasCalculations: !!profile?.calculations,
            calculationsKeys: profile?.calculations ? Object.keys(profile.calculations) : [],
            profileKeys: profile ? Object.keys(profile) : []
          });
          
          if (profile && profile.calculations) {
            const estateDocuments = await storage.getEstateDocuments(userId);
            
            const insightsResult = await generateGeminiInsights(
              profile, 
              profile.calculations, 
              estateDocuments
            );
            
            const newInsights = await storage.createDashboardInsights(userId, {
              insights: insightsResult.insights,
              generatedByModel: "gemini-2.5-flash-lite",
              generationPrompt: insightsResult.generationPrompt,
              generationVersion: "1.0",
              financialSnapshot: insightsResult.financialSnapshot,
              profileDataHash: insightsResult.profileDataHash,
              validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
            
            // Invalidate dashboard snapshot so next fetch includes insights
            try {
              const { cacheService } = await import('./services/cache.service');
              await cacheService.invalidate('dashboard_snapshot');
            } catch {}

            // Update view count and return
            await storage.updateDashboardInsightsViewCount(userId);
            
            return res.json({
              insights: newInsights.insights,
              generatedAt: (newInsights as any).updatedAt || newInsights.createdAt,
              isValid: true,
              generatedByModel: newInsights.generatedByModel
            });
          }
        } catch (generateError) {
          console.error('Failed to generate initial insights:', generateError);
          console.error('Error stack:', generateError.stack);
        }
        
        return res.json({
          insights: [],
          message: "No insights available yet. Please complete your financial profile first."
        });
      }
      
      // Update view count
      await storage.updateDashboardInsightsViewCount(userId);
      
      // Check if insights are still valid
      const isValid = !insights.validUntil || new Date() < insights.validUntil;
      
      res.json({
        insights: insights.insights,
        generatedAt: (insights as any).updatedAt || insights.createdAt,
        isValid,
        generatedByModel: insights.generatedByModel,
        viewCount: (insights.viewCount || 0) + 1
      });
      
    } catch (error) {
      next(error);
    }
  });

  // Retirement Confidence Bands widget API
  app.get('/api/widgets/retirement-confidence', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const userId = req.user!.id;

      const profile = await storage.getFinancialProfile(userId);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });

      // Build dependency hash based on lastUpdated and core params
      const currentAge = (() => {
        const dob = (profile as any).dateOfBirth as string | null;
        if (dob) {
          const d = new Date(dob);
          const diff = Date.now() - d.getTime();
          return Math.max(18, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
        }
        return (profile as any).currentAge || 50;
      })();
      const retirementAge = (profile as any).desiredRetirementAge || (profile as any).retirementAge || 65;
      const dependencies = {
        lastUpdated: (profile as any).lastUpdated || new Date().toISOString(),
        currentAge,
        retirementAge,
        longevityAge: 93
      };
      const { widgetCacheManager } = await import('./widget-cache-manager');
      const inputHash = widgetCacheManager.generateInputHash('retirement_confidence_bands', dependencies);

      // Revalidate option enqueues background calcs
      if (req.query.revalidate === 'true') {
        enqueuePostProfileCalcs(userId);
      }

      const cached = await widgetCacheManager.getCachedWidget(userId, 'retirement_confidence_bands', inputHash);
      if (!cached) {
        // No cache yet; enqueue calculation and return accepted
        enqueuePostProfileCalcs(userId);
        return res.status(202).json({ queued: true });
      }

      // Slim payload: keep only p25/p50/p75 bands if present
      const bands = cached.data?.bands;
      const slim = bands ? {
        ages: bands.ages,
        percentiles: {
          p25: bands.percentiles?.p25 || [],
          p50: bands.percentiles?.p50 || [],
          p75: bands.percentiles?.p75 || [],
        },
        meta: bands.meta,
      } : null;
      return res.json({
        meta: cached.data.meta,
        bands: slim
      });
    } catch (error) {
      next(error);
    }
  });

  // Manual insights regeneration endpoint
  app.post("/api/regenerate-dashboard-insights", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      
      console.log('Manual insights regeneration requested...');
      const { generateGeminiInsights, createProfileDataHash } = await import('./gemini-insights');
      
      const profile = await storage.getFinancialProfile(userId);
      if (!profile || !profile.calculations) {
        return res.status(400).json({ 
          error: "Complete financial profile required for insights generation" 
        });
      }
      
      const estateDocuments = await storage.getEstateDocuments(userId);
      
      // Generate new insights
      const insightsResult = await generateGeminiInsights(
        profile, 
        profile.calculations, 
        estateDocuments
      );
      
      // Save insights to database
      const newInsights = await storage.createDashboardInsights(userId, {
        insights: insightsResult.insights,
        generatedByModel: "gemini-2.5-flash-lite",
        generationPrompt: insightsResult.generationPrompt,
        generationVersion: "1.0",
        financialSnapshot: insightsResult.financialSnapshot,
        profileDataHash: insightsResult.profileDataHash,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
      
      console.log(`✅ Manually generated and saved ${insightsResult.insights.length} fresh insights`);
      
      // Invalidate dashboard snapshot so next fetch includes refreshed insights
      try {
        const { cacheService } = await import('./services/cache.service');
        await cacheService.invalidate('dashboard_snapshot');
      } catch {}

      res.json({
        insights: newInsights.insights,
        generatedAt: newInsights.createdAt,
        isValid: true,
        generatedByModel: newInsights.generatedByModel,
        message: "Insights regenerated successfully"
      });
      
    } catch (error) {
      console.error('Error during manual insights regeneration:', error);
      next(error);
    }
  });

  // Comprehensive Insights endpoints - access ALL database data for enhanced analysis
  app.get("/api/comprehensive-insights", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;
      
      // Get cached comprehensive insights
      const insights = await storage.getComprehensiveInsights(userId);
      
      if (!insights) {
        return res.json({ 
          insights: [], 
          success: true,
          message: "No comprehensive insights available. Click 'Generate Comprehensive Insights' to analyze your complete financial profile.",
          meta: {
            isValid: false
          }
        });
      }
      
      // Check if insights are still valid (24 hour cache)
      const isValid = insights.validUntil && new Date(insights.validUntil) > new Date();
      
      res.json({
        insights: insights.insights,
        success: true,
        message: isValid ? "Comprehensive insights loaded" : "Insights may be outdated. Consider regenerating.",
        meta: {
          generatedAt: (insights as any).updatedAt || insights.createdAt,
          isValid,
          generatedByModel: insights.generatedByModel
        }
      });
      
    } catch (error) {
      console.error('Error fetching comprehensive insights:', error);
      next(error);
    }
  });

  app.post("/api/comprehensive-insights", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;
      
      console.log('Comprehensive insights generation requested for user:', userId);
      
      // Get complete financial profile with ALL data
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ 
          error: "Financial profile not found. Please complete your intake form first." 
        });
      }

      // Require complete calculations for comprehensive analysis
      if (!profile.calculations || typeof profile.calculations !== 'object') {
        return res.status(400).json({ 
          error: "Complete financial calculations required. Please ensure your dashboard widgets have been calculated." 
        });
      }
      
      // Additional validation for critical calculation fields
      const calculations = profile.calculations as any;
      if (!calculations.netWorth && !calculations.healthScore) {
        return res.status(400).json({
          error: "Insufficient calculation data. Please recalculate your dashboard widgets first."
        });
      }
      
      const { generateGeminiInsights } = await import('./gemini-insights');
      const estateDocuments = await storage.getEstateDocuments(userId);
      
      // Generate comprehensive insights using complete database data
      console.log('Generating comprehensive insights using complete financial profile...');
      const insightsResult = await generateGeminiInsights(
        profile,           // Complete intake form data
        profile.calculations, // All dashboard widget calculations
        estateDocuments    // Estate planning documents
      );
      
      // Ensure we have 8-12 insights for CFP-level sophistication
      if (insightsResult.insights.length < 8) {
        console.warn(`Only generated ${insightsResult.insights.length} insights, expected minimum 8 for CFP-level recommendations`);
      } else if (insightsResult.insights.length > 12) {
        console.log(`Generated ${insightsResult.insights.length} insights, truncating to 12 for optimal user experience`);
        insightsResult.insights = insightsResult.insights.slice(0, 12);
      }
      
      // Save comprehensive insights (separate from regular dashboard insights)
      const savedInsights = await storage.createComprehensiveInsights(userId, {
        insights: insightsResult.insights,
        generatedByModel: "gemini-2.5-flash-lite",
        generationPrompt: insightsResult.generationPrompt,
        generationVersion: "2.0-comprehensive",
        financialSnapshot: insightsResult.financialSnapshot,
        profileDataHash: insightsResult.profileDataHash,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours cache
      });
      
      console.log(`✅ Generated and saved ${insightsResult.insights.length} comprehensive insights`);
      
      // Invalidate dashboard snapshot so next fetch includes refreshed insights
      try {
        const { cacheService } = await import('./services/cache.service');
        await cacheService.invalidate('dashboard_snapshot');
      } catch {}

      res.json({
        insights: savedInsights.insights,
        success: true,
        message: `Generated ${insightsResult.insights.length} comprehensive insights from your complete financial profile`,
        meta: {
          generatedAt: (savedInsights as any).updatedAt || savedInsights.createdAt,
          isValid: true,
          generatedByModel: savedInsights.generatedByModel
        }
      });
      
    } catch (error) {
      console.error('Error generating comprehensive insights:', error);
      res.status(500).json({ 
        error: "Failed to generate comprehensive insights. Please try again."
        // Removed error.message to prevent internal detail exposure
      });
    }
  });

  // Retirement planning data route
  app.put("/api/retirement-planning-data", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      
      // Update only the retirement planning data
      const updatedProfile = await storage.updateFinancialProfile(userId, {
        retirementPlanningData: req.body
      });
      
      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  });


  // Test endpoint for Social Security optimization  
  app.post('/api/test-ss-optimization', async (req, res) => {
    try {
      const { LifetimeCashFlowOptimizer } = await import("./lifetime-cashflow-optimizer");
      
      console.log('=== TEST SS OPTIMIZATION ENDPOINT ===');
      console.log('Input data keys:', Object.keys(req.body));
      
      const result = LifetimeCashFlowOptimizer.calculateOptimalAgesFromProfile(req.body);
      
      res.json({
        success: !!result,
        result: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Test optimization error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual trigger for SS optimization
  app.post('/api/trigger-ss-optimization', async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const profile = await storage.getFinancialProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      const { LifetimeCashFlowOptimizer } = await import("./lifetime-cashflow-optimizer");
      
      console.log('=== MANUAL SS OPTIMIZATION TRIGGER ===');
      const result = LifetimeCashFlowOptimizer.calculateOptimalAgesFromProfile(profile);
      
      if (result) {
        // Update the profile with the optimal ages
        await storage.updateFinancialProfile(userId, {
          optimalSocialSecurityAge: result.optimalUserAge,
          optimalSpouseSocialSecurityAge: result.optimalSpouseAge,
          socialSecurityOptimization: {
            lifetimeCashFlow: result.totalLifetimeCashFlow,
            calculatedAt: new Date().toISOString(),
            methodology: 'lifetime_cashflow_analysis',
            alternativeScenarios: result.alternativeScenarios.slice(0, 5)
          }
        });
        
        console.log('✅ Profile updated with optimal SS ages');
        
        res.json({
          success: true,
          optimalUserAge: result.optimalUserAge,
          optimalSpouseAge: result.optimalSpouseAge,
          lifetimeCashFlow: result.totalLifetimeCashFlow,
          message: 'Optimization completed and saved'
        });
      } else {
        res.json({
          success: false,
          message: 'Unable to calculate optimization - insufficient data'
        });
      }
    } catch (error) {
      console.error('Manual SS optimization error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Force recalculation of Social Security benefits with corrected algorithm
  app.post('/api/recalculate-ss-benefits-fixed', async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const profile = await storage.getFinancialProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      console.log('=== RECALCULATING SS BENEFITS WITH FIXED ALGORITHM ===');
      
      // Import the corrected calculation functions
      const { calculateSocialSecurityBenefit } = await import('./social-security-calculator');
      const { calculateOptimalSSClaimAges } = await import('./optimal-ss-claim');
      
      // Recalculate user SS benefit from income
      let newUserBenefit = 0;
      if (profile.annualIncome && profile.annualIncome > 0) {
        const monthlyIncome = profile.annualIncome / 12;
        const currentAge = profile.dateOfBirth ? 
          Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 51;
        
        // Calculate benefit at FRA (67)
        newUserBenefit = calculateSocialSecurityBenefit(monthlyIncome, currentAge, 67);
        console.log(`User: Income=$${profile.annualIncome}, Age=${currentAge}, New SS benefit=$${newUserBenefit} (was: $${profile.socialSecurityBenefit})`);
      }
      
      // Recalculate spouse SS benefit from income
      let newSpouseBenefit = 0;
      if (profile.spouseAnnualIncome && profile.spouseAnnualIncome > 0) {
        const spouseMonthlyIncome = profile.spouseAnnualIncome / 12;
        const spouseCurrentAge = profile.spouseDateOfBirth ? 
          Math.floor((Date.now() - new Date(profile.spouseDateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 51;
        
        // Calculate benefit at FRA (67)
        newSpouseBenefit = calculateSocialSecurityBenefit(spouseMonthlyIncome, spouseCurrentAge, 67);
        console.log(`Spouse: Income=$${profile.spouseAnnualIncome}, Age=${spouseCurrentAge}, New SS benefit=$${newSpouseBenefit} (was: $${profile.spouseSocialSecurityBenefit})`);
      }
      
      // Calculate optimal claiming ages with new benefits
      const optimalAges = calculateOptimalSSClaimAges(profile);
      
      // Update the profile with corrected values
      const updates: any = {
        socialSecurityBenefit: newUserBenefit,
        optimalSocialSecurityAge: optimalAges.user.optimalAge
      };
      
      if (profile.maritalStatus === 'married' && newSpouseBenefit > 0) {
        updates.spouseSocialSecurityBenefit = newSpouseBenefit;
        if (optimalAges.spouse) {
          updates.optimalSpouseSocialSecurityAge = optimalAges.spouse.optimalAge;
        }
      }
      
      await storage.updateFinancialProfile(userId, updates);
      
      console.log('✅ Profile updated with corrected SS benefits and optimal ages');
      
      res.json({
        success: true,
        updates: {
          userBenefit: { old: profile.socialSecurityBenefit, new: newUserBenefit },
          spouseBenefit: { old: profile.spouseSocialSecurityBenefit, new: newSpouseBenefit },
          userOptimalAge: optimalAges.user.optimalAge,
          spouseOptimalAge: optimalAges.spouse?.optimalAge
        },
        message: 'Social Security benefits recalculated with corrected algorithm'
      });
      
    } catch (error) {
      console.error('SS recalculation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // New cumulative Social Security optimizer endpoint
  app.post('/api/calculate-cumulative-ss-optimization', async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const profile = await storage.getFinancialProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      console.log('=== CUMULATIVE SS OPTIMIZATION REQUEST ===');
      
      // Check if force refresh is requested
      const forceRefresh = req.query.force === 'true';
      
      // Check if we have cached SS optimization data
      const optimizationVariables = profile.optimizationVariables || {};
      const cachedSSOptimization = optimizationVariables.socialSecurityOptimization;
      
      if (!forceRefresh && cachedSSOptimization && cachedSSOptimization.calculatedAt) {
        const cacheAge = Date.now() - new Date(cachedSSOptimization.calculatedAt).getTime();
        const ONE_DAY = 24 * 60 * 60 * 1000; // Cache for 24 hours
        
        // Check if the cached data is still fresh and profile hasn't changed significantly
        if (cacheAge < ONE_DAY && 
            cachedSSOptimization.profileSnapshot && 
            cachedSSOptimization.profileSnapshot.annualIncome === profile.annualIncome &&
            cachedSSOptimization.profileSnapshot.spouseAnnualIncome === profile.spouseAnnualIncome &&
            cachedSSOptimization.profileSnapshot.dateOfBirth === profile.dateOfBirth &&
            cachedSSOptimization.profileSnapshot.spouseDateOfBirth === profile.spouseDateOfBirth &&
            cachedSSOptimization.profileSnapshot.retirementAge === profile.retirementAge &&
            cachedSSOptimization.profileSnapshot.spouseRetirementAge === profile.spouseRetirementAge) {
          
          console.log('Using CACHED Social Security optimization (age: ' + Math.round(cacheAge / 1000 / 60) + ' minutes)');
          return res.json({
            ...cachedSSOptimization.result,
            isCached: true,
            calculatedAt: cachedSSOptimization.calculatedAt
          });
        } else {
          console.log('Cached SS optimization is stale or profile changed, recalculating...');
        }
      }
      
      // Import the new optimizer
      const { calculateCumulativeSSOptimization } = await import('./cumulative-ss-optimizer.js');
      
      // Calculate optimization
      const result = calculateCumulativeSSOptimization(profile);
      
      // Save the optimization result to the database
      const updatedOptimizationVariables = {
        ...optimizationVariables,
        socialSecurityOptimization: {
          result: result,
          calculatedAt: new Date().toISOString(),
          profileSnapshot: {
            annualIncome: profile.annualIncome,
            spouseAnnualIncome: profile.spouseAnnualIncome,
            dateOfBirth: profile.dateOfBirth,
            spouseDateOfBirth: profile.spouseDateOfBirth,
            retirementAge: profile.retirementAge,
            spouseRetirementAge: profile.spouseRetirementAge
          }
        }
      };
      
      // Update the profile with cached SS optimization
      await storage.updateFinancialProfile(req.user!.id, {
        optimizationVariables: updatedOptimizationVariables
      });
      
      console.log('Social Security optimization calculated and cached');
      
      res.json(result);
    } catch (error) {
      console.error('Cumulative SS optimization error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Widget cache management endpoints
  app.post('/api/widget-cache/invalidate-all', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;
      
      const { widgetCacheManager } = await import('./widget-cache-manager');
      await widgetCacheManager.invalidateAllUserCache(userId);
      
      console.log(`[WIDGET-CACHE-API] Invalidated all cached widgets for user ${userId}`);
      res.json({ success: true, message: 'All widget caches invalidated' });
    } catch (error) {
      console.error('[WIDGET-CACHE-API] Error invalidating all caches:', error);
      next(error);
    }
  });

  app.post('/api/widget-cache/invalidate/:widgetType', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;
      const { widgetType } = req.params;
      
      const { widgetCacheManager } = await import('./widget-cache-manager');
      await widgetCacheManager.invalidateWidget(userId, widgetType);
      
      console.log(`[WIDGET-CACHE-API] Invalidated ${widgetType} cache for user ${userId}`);
      res.json({ success: true, message: `${widgetType} cache invalidated` });
    } catch (error) {
      console.error(`[WIDGET-CACHE-API] Error invalidating ${req.params.widgetType} cache:`, error);
      next(error);
    }
  });

  // --- Health Endpoints ---
  app.get('/api/health/db', async (_req, res) => {
    try {
      const { pool } = await import('./db');
      const client = await pool.connect();
      try {
        const r = await client.query('SELECT NOW() as now');
        return res.json({ ok: true, now: r.rows?.[0]?.now });
      } finally {
        client.release();
      }
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || 'DB error' });
    }
  });

  app.get('/api/health/supabase', async (_req, res) => {
    try {
      const { requireSupabase } = await import('./supabase');
      const supabase = requireSupabase();
      // Try a lightweight query; assumes 'users' table exists. Service role key recommended.
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      if (error) {
        return res.status(500).json({ ok: false, error: error.message });
      }
      return res.json({ ok: true, sample: (data && data.length) ? data[0] : null });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || 'Supabase error' });
    }
  });

  app.get('/api/health/all', async (_req, res) => {
    const out: any = { db: { ok: false }, supabase: { ok: false } };
    try {
      const { pool } = await import('./db');
      const client = await pool.connect();
      try {
        const r = await client.query('SELECT NOW() as now');
        out.db = {
          ok: true,
          now: r.rows?.[0]?.now,
          pool: {
            total: (pool as any).totalCount ?? undefined,
            idle: (pool as any).idleCount ?? undefined,
            waiting: (pool as any).waitingCount ?? undefined,
          }
        };
      } finally {
        client.release();
      }
    } catch (e: any) {
      out.db = { ok: false, error: e?.message || 'DB error' };
    }
    try {
      const { requireSupabase } = await import('./supabase');
      const supabase = requireSupabase();
      const { data, error } = await supabase.from('users').select('id').limit(1);
      if (error) throw error;
      out.supabase = { ok: true, sample: (data && data.length) ? data[0] : null };
    } catch (e: any) {
      out.supabase = { ok: false, error: e?.message || 'Supabase error' };
    }
    res.json(out);
  });

  app.get('/api/widget-cache/stats', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;
      
      const { widgetCacheManager } = await import('./widget-cache-manager');
      const stats = await widgetCacheManager.getCacheStats(userId);
      
      res.json(stats);
    } catch (error) {
      console.error('[WIDGET-CACHE-API] Error getting cache stats:', error);
      next(error);
    }
  });

  // Calculate retirement Monte Carlo simulation
  app.post("/api/calculate-retirement-monte-carlo", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      // Check if client wants fresh calculation (dashboard widget)
      const skipCache = req.body?.skipCache === true;
      
      // Check if advisor is acting as client
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;
      
      // Get the user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      // Check if Step 11 (retirement planning data) has been completed
      // These fields are required for meaningful Monte Carlo simulations
      const requiredRetirementFields = [
        'desiredRetirementAge',
        'expectedMonthlyExpensesRetirement',
        'socialSecurityClaimAge',
        'socialSecurityBenefit'
      ];
      
      const missingFields = requiredRetirementFields.filter(field => !profile[field]);
      
      if (missingFields.length > 0) {
        console.log('⚠️ Monte Carlo calculation attempted without complete retirement data');
        console.log('Missing fields:', missingFields);
        console.log('User should complete Step 11 of intake form first');
        
        return res.status(400).json({ 
          error: "Retirement planning data incomplete. Please complete Step 11 of the intake form to enable Monte Carlo simulations.",
          message: "Click refresh to calculate your retirement confidence score using your saved intake form data.",
          missingFields,
          requiresStep: 11
        });
      }
      
      // Additional validation for critical numeric fields
      if (profile.expectedMonthlyExpensesRetirement <= 0) {
        console.log('⚠️ Invalid retirement expenses:', profile.expectedMonthlyExpensesRetirement);
        return res.status(400).json({
          error: "Invalid retirement expenses. Please provide your expected monthly expenses in retirement.",
          message: "Update your expected monthly retirement expenses in Step 11 of the intake form.",
          requiresStep: 11
        });
      }
      
      // Enhance profile with Plaid data
      let enhancedProfile = { ...profile };
      try {
        const { PlaidDataAggregator } = await import('./services/plaid-data-aggregator');
        
        // Get retirement accounts from Plaid
        const retirementData = await PlaidDataAggregator.getRetirementAccounts(userId);
        
        // Get complete financial picture
        const financialData = await PlaidDataAggregator.getUserCompleteFinancialPicture(userId);
        
        // Merge Plaid retirement account data with manual assets
        if (retirementData && retirementData.breakdown) {
          console.log('Enhancing Monte Carlo with Plaid retirement data:', retirementData.breakdown);
          
          // Update retirement account balances with Plaid data
          const assets = enhancedProfile.assets || [];
          
          // Add or update 401k balance from Plaid
          if (retirementData.breakdown.traditional401k > 0 || retirementData.breakdown.roth401k > 0) {
            const total401k = retirementData.breakdown.traditional401k + retirementData.breakdown.roth401k;
            const existing401k = assets.find((a: any) => a.type === '401k');
            if (existing401k) {
              existing401k.value = total401k;
              existing401k.dataSource = 'plaid';
            } else {
              assets.push({
                type: '401k',
                value: total401k,
                owner: 'user',
                dataSource: 'plaid'
              });
            }
          }
          
          // Add or update IRA balances from Plaid
          if (retirementData.breakdown.traditionalIRA > 0) {
            const existingIRA = assets.find((a: any) => a.type === 'traditional-ira');
            if (existingIRA) {
              existingIRA.value = retirementData.breakdown.traditionalIRA;
              existingIRA.dataSource = 'plaid';
            } else {
              assets.push({
                type: 'traditional-ira',
                value: retirementData.breakdown.traditionalIRA,
                owner: 'user',
                dataSource: 'plaid'
              });
            }
          }
          
          if (retirementData.breakdown.rothIRA > 0) {
            const existingRoth = assets.find((a: any) => a.type === 'roth-ira');
            if (existingRoth) {
              existingRoth.value = retirementData.breakdown.rothIRA;
              existingRoth.dataSource = 'plaid';
            } else {
              assets.push({
                type: 'roth-ira',
                value: retirementData.breakdown.rothIRA,
                owner: 'user',
                dataSource: 'plaid'
              });
            }
          }
          
          enhancedProfile.assets = assets;
        }
        
        // Use aggregated cash flow data if available
        if (financialData && financialData.totals) {
          console.log('Using Plaid aggregated data for Monte Carlo');
          enhancedProfile.plaidNetWorth = financialData.totals.netWorth;
          enhancedProfile.plaidTotalAssets = financialData.totals.totalAssets;
          enhancedProfile.plaidRetirementAssets = financialData.assets.retirement401k + 
                                                 financialData.assets.retirementIRA + 
                                                 financialData.assets.retirementRoth;
        }
      } catch (plaidError) {
        console.log('Plaid data not available for Monte Carlo, using manual data only:', plaidError);
      }

      // IMPORTANT: Do NOT apply optimization variables here
      // This endpoint should always show the baseline/current plan
      // Optimization variables are only for the optimization tab
      let profileToUse = { ...enhancedProfile };
      
      // Log if optimization variables exist but we're NOT applying them
      if (profile.optimizationVariables && profile.optimizationVariables.lockedAt) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️  OPTIMIZATION VARIABLES EXIST BUT NOT APPLIED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('This endpoint (/api/calculate-retirement-monte-carlo) always shows:');
        console.log('  • BASELINE/CURRENT PLAN score (using original profile values)');
        console.log('  • NOT the optimized score');
        console.log('');
        console.log('Locked optimization variables:', {
          retirementAge: profile.optimizationVariables.retirementAge,
          socialSecurityAge: profile.optimizationVariables.socialSecurityAge,
          monthlyContributions: profile.optimizationVariables.monthlyContributions,
          optimizedScore: profile.optimizationVariables.optimizedScore?.probabilityOfSuccess
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
      
      // Skip the entire optimization variables application block
      // The following code has been intentionally removed to fix the bug
      // where locked variables were incorrectly changing the baseline score
      /*
      if (profile.optimizationVariables && profile.optimizationVariables.lockedAt) {
        // This code was applying optimization variables to baseline calculation
        // which was incorrect - baseline should always show original values
          const currentAge = profileToUse.dateOfBirth 
            ? new Date().getFullYear() - new Date(profileToUse.dateOfBirth).getFullYear() 
            : 30;
          
          // Calculate AIME and PIA (AIME expects MONTHLY income)
          const monthlyIncome = (profileToUse.annualIncome || 0) / 12;
          const userAIME = calculateAIME(monthlyIncome, currentAge, 67);
          const userPIA = calculatePrimaryInsuranceAmount(userAIME);
          
          // Calculate benefit at the chosen claim age
          const adjustedBenefit = calculateBenefitAtAge(variables.socialSecurityAge, 67, userPIA);
          profileToUse.socialSecurityBenefit = adjustedBenefit;
        }
        
        if (variables.spouseSocialSecurityAge !== undefined) {
          profileToUse.spouseSocialSecurityClaimAge = variables.spouseSocialSecurityAge;
          
          // Recalculate spouse Social Security benefit if married/partnered
          if ((profileToUse.maritalStatus === 'married' || profileToUse.maritalStatus === 'partnered') && 
              profileToUse.spouseAnnualIncome) {
            const spouseAge = profileToUse.spouseDateOfBirth 
              ? new Date().getFullYear() - new Date(profileToUse.spouseDateOfBirth).getFullYear() 
              : 30;
            
            // Calculate spouse AIME and PIA (AIME expects MONTHLY income)
            const spouseMonthlyIncome = (profileToUse.spouseAnnualIncome || 0) / 12;
            const spouseAIME = calculateAIME(spouseMonthlyIncome, spouseAge, 67);
            const spousePIA = calculatePrimaryInsuranceAmount(spouseAIME);
            
            // Calculate spouse benefit at the chosen claim age
            const adjustedSpouseBenefit = calculateBenefitAtAge(variables.spouseSocialSecurityAge, 67, spousePIA);
            profileToUse.spouseSocialSecurityBenefit = adjustedSpouseBenefit;
          }
        }
        
        // Apply asset allocation strategy
        if (variables.assetAllocation === 'current-allocation') {
          profileToUse.expectedRealReturn = -2; // Special value for current allocation
        } else if (variables.assetAllocation === 'glide-path') {
          profileToUse.expectedRealReturn = -1; // Special value for glide path
        } else if (variables.assetAllocation) {
          profileToUse.expectedRealReturn = parseFloat(variables.assetAllocation) / 100; // Convert percentage to decimal
        }
        
        // Apply monthly contributions (convert to annual)
        if (variables.monthlyContributions !== undefined) {
          const annualContributions = variables.monthlyContributions * 12;
          profileToUse.retirementContributions = {
            employee: annualContributions,
            employer: 0
          };
          
          // If married/partnered, apply to spouse as well
          if (profileToUse.maritalStatus === 'married' || profileToUse.maritalStatus === 'partnered') {
            profileToUse.spouseRetirementContributions = {
              employee: annualContributions,
              employer: 0
            };
          }
        }
        
        // Apply life expectancy
        if (variables.lifeExpectancy !== undefined) {
          profileToUse.userLifeExpectancy = variables.lifeExpectancy;
        }
        if (variables.spouseLifeExpectancy !== undefined) {
          profileToUse.spouseLifeExpectancy = variables.spouseLifeExpectancy;
        }
        
        // Apply monthly expenses
        if (variables.monthlyExpenses !== undefined) {
          profileToUse.expectedMonthlyExpensesRetirement = variables.monthlyExpenses;
        }
        
        // Apply part-time income
        if (variables.partTimeIncome !== undefined) {
          profileToUse.partTimeIncomeRetirement = variables.partTimeIncome;
        }
        if (variables.spousePartTimeIncome !== undefined) {
          profileToUse.spousePartTimeIncomeRetirement = variables.spousePartTimeIncome;
        }
        
        // Apply Long-Term Care Insurance
        if (variables.hasLongTermCareInsurance !== undefined) {
          profileToUse.hasLongTermCareInsurance = variables.hasLongTermCareInsurance;
        }
        
        console.log('Optimization variables applied:', {
          retirementAge: variables.retirementAge,
          monthlyContributions: variables.monthlyContributions,
          socialSecurityAge: variables.socialSecurityAge,
          lifeExpectancy: variables.lifeExpectancy,
          hasLongTermCareInsurance: variables.hasLongTermCareInsurance
        });
      }
      */

      // Check Redis cache first (faster than database) - ONLY if not skipping cache
      if (!skipCache) {
        const cacheKey = {
          userId,
          profileUpdatedAt: profile.lastUpdated,
          age: profileToUse.dateOfBirth ? new Date().getFullYear() - new Date(profileToUse.dateOfBirth).getFullYear() : 30,
          annualIncome: profileToUse.annualIncome,
          retirementAge: profileToUse.desiredRetirementAge || profileToUse.retirementAge,
          monthlyExpenses: profileToUse.expectedMonthlyExpensesRetirement,
          socialSecurityBenefit: profileToUse.socialSecurityBenefit,
          expectedReturn: profileToUse.expectedRealReturn,
          maritalStatus: profileToUse.maritalStatus,
          spouseIncome: profileToUse.spouseAnnualIncome,
          spouseBenefit: profileToUse.spouseSocialSecurityBenefit
        };
        
        const redisCached = await cacheService.get(`monte_carlo:${userId}`, cacheKey);
        if (redisCached) {
          console.log('[Redis Cache] HIT: Monte Carlo results from Redis');
          return res.json({ ...redisCached, isCached: true, cacheSource: 'redis' });
        }
      } else {
        console.log('[Dashboard Widget] Skipping cache for fresh Monte Carlo calculation');
      }
      
      // Check for cached Monte Carlo results using new widget cache system
      const { widgetCacheManager } = await import('./widget-cache-manager');
      
      // Generate cache dependencies for Monte Carlo simulation
      const monteCarloDependencies = {
        profileUpdatedAt: profile.lastUpdated,
        age: profileToUse.dateOfBirth ? new Date().getFullYear() - new Date(profileToUse.dateOfBirth).getFullYear() : 30,
        annualIncome: profileToUse.annualIncome,
        currentAssets: profileToUse.assets,
        retirementAge: profileToUse.desiredRetirementAge || profileToUse.retirementAge,
        monthlyExpenses: profileToUse.expectedMonthlyExpensesRetirement,
        socialSecurityBenefit: profileToUse.socialSecurityBenefit,
        expectedReturn: profileToUse.expectedRealReturn,
        maritalStatus: profileToUse.maritalStatus,
        // Include spouse data if married
        ...(profileToUse.maritalStatus === 'married' && {
          spouseIncome: profileToUse.spouseAnnualIncome,
          spouseBenefit: profileToUse.spouseSocialSecurityBenefit,
          spouseAge: profileToUse.spouseDateOfBirth ? new Date().getFullYear() - new Date(profileToUse.spouseDateOfBirth).getFullYear() : null
        })
      };
      
      const inputHash = widgetCacheManager.generateInputHash('monte_carlo_retirement', monteCarloDependencies);
      
      // Skip widget cache if skipCache is true
      if (!skipCache) {
        const cachedWidget = await widgetCacheManager.getCachedWidget(userId, 'monte_carlo_retirement', inputHash);
        
        if (cachedWidget) {
          console.log('[MONTE-CARLO-CACHE] Using cached Monte Carlo results from widget cache');
          const cachedResult = {
            ...cachedWidget.data,
            calculatedAt: cachedWidget.calculatedAt,
            isCached: true,
            inputHash: cachedWidget.inputHash
          };
          
          res.json(cachedResult);
          return; // Exit early with cached data
        } else {
          console.log('[MONTE-CARLO-CACHE] No cached data found, running fresh calculation');
        }
      }

      // Convert profile data to Monte Carlo parameters
      console.log('DEBUG: Profile hasLongTermCareInsurance value from DB:', profileToUse.hasLongTermCareInsurance);
      console.log('DEBUG: Profile object type check:', {
        isObject: typeof profileToUse === 'object',
        hasLTCField: 'hasLongTermCareInsurance' in profileToUse,
        ltcValue: profileToUse.hasLongTermCareInsurance,
        ltcType: typeof profileToUse.hasLongTermCareInsurance
      });
      const params = profileToRetirementParams(profileToUse);
      // Use real dollars for consistency with prior behavior
      (params as any).useNominalDollars = false;
      (params as any).displayInTodaysDollars = true;
      // Integrate charitable goal into success probability
      (params as any).includeLegacyGoalInSuccess = true;
      // Seed handshake: accept client seed or derive from input hash
      const { seed: clientSeed, randomSeed: clientRandomSeed } = req.body || {};
      const { hash32 } = await import('./rng');
      const derivedSeed = hash32(String(inputHash));
      const seed = typeof clientSeed === 'number' ? (clientSeed >>> 0) :
                   typeof clientRandomSeed === 'number' ? (clientRandomSeed >>> 0) : derivedSeed;
      (params as any).randomSeed = seed;
      const correlationId = `mc:${userId}:${String(inputHash).slice(0,12)}`;
      
      console.log('\n========================================');
      console.log('=== RETIREMENT MONTE CARLO CALCULATION ===');
      console.log('========================================');
      console.log(`USER: ${profileToUse.firstName} ${profileToUse.lastName}`);
      if (profileToUse.maritalStatus === 'married' || profileToUse.maritalStatus === 'partnered') {
        console.log(`SPOUSE: ${profileToUse.spouseName || 'Not specified'}`);
      }
      console.log(`DATE/TIME: ${new Date().toLocaleString()}`);
      console.log('========================================\n');
      console.log('[MonteCarlo] CorrelationID:', correlationId, 'Seed:', seed);
      
      // Log all intake form data
      console.log('--- PERSONAL INFORMATION ---');
      console.log(`Date of Birth: ${profileToUse.dateOfBirth}`);
      console.log(`Current Age: ${params.currentAge}`);
      console.log(`Marital Status: ${profileToUse.maritalStatus}`);
      console.log(`State of Residence: ${profileToUse.state}`);
      console.log(`Retirement State: ${profileToUse.retirementState}`);
      console.log(`Number of Dependents: ${profileToUse.dependents || 0}`);
      
      console.log('\n--- EMPLOYMENT & INCOME ---');
      console.log(`Employment Status: ${profileToUse.employmentStatus}`);
      console.log(`Annual Income: $${profileToUse.annualIncome?.toLocaleString() || 0}`);
      console.log(`Take Home Income: $${profileToUse.takeHomeIncome?.toLocaleString() || 0}`);
      if (profileToUse.maritalStatus === 'married' || profileToUse.maritalStatus === 'partnered') {
        console.log(`Spouse Employment Status: ${profileToUse.spouseEmploymentStatus}`);
        console.log(`Spouse Annual Income: $${profileToUse.spouseAnnualIncome?.toLocaleString() || 0}`);
        console.log(`Spouse Take Home Income: $${profileToUse.spouseTakeHomeIncome?.toLocaleString() || 0}`);
      }
      
      console.log('\n--- RETIREMENT PLANNING ---');
      console.log(`Desired Retirement Age: ${profileToUse.desiredRetirementAge || params.retirementAge}`);
      console.log(`Life Expectancy (User): ${profileToUse.userLifeExpectancy || params.lifeExpectancy}`);
      if (profileToUse.maritalStatus === 'married' || profileToUse.maritalStatus === 'partnered') {
        console.log(`Life Expectancy (Spouse): ${profileToUse.spouseLifeExpectancy || 'Not specified'}`);
      }
      console.log(`Expected Monthly Expenses in Retirement: $${profileToUse.expectedMonthlyExpensesRetirement?.toLocaleString() || 0}`);
      console.log(`Social Security Claim Age: ${profileToUse.socialSecurityClaimAge || 67}`);
      console.log(`Social Security Benefit: $${profileToUse.socialSecurityBenefit?.toLocaleString() || 0}/month`);
      console.log(`Pension Benefit: $${profileToUse.pensionBenefit?.toLocaleString() || 0}/month`);
      console.log(`Part-time Income in Retirement: $${profileToUse.partTimeIncomeRetirement?.toLocaleString() || 0}/month`);
      if (profileToUse.maritalStatus === 'married' || profileToUse.maritalStatus === 'partnered') {
        console.log(`Spouse Social Security Benefit: $${profileToUse.spouseSocialSecurityBenefit?.toLocaleString() || 0}/month`);
        console.log(`Spouse Pension Benefit: $${profileToUse.spousePensionBenefit?.toLocaleString() || 0}/month`);
        console.log(`Spouse Part-time Income in Retirement: $${profileToUse.spousePartTimeIncomeRetirement?.toLocaleString() || 0}/month`);
      }
      
      console.log('\n--- ASSETS ---');
      const assets = profileToUse.assets as any[] | undefined;
      console.log(`Total Assets Count: ${assets?.length || 0}`);
      if (assets && assets.length > 0) {
        assets.forEach((asset: any, index: number) => {
          console.log(`  Asset ${index + 1}: ${asset.type} - $${asset.value?.toLocaleString() || 0} (${asset.owner || 'user'}) - ${asset.description || 'No description'}`);
        });
      }
      console.log(`Retirement Assets Total: $${params.currentRetirementAssets.toLocaleString()}`);
      
      console.log('\n--- INSURANCE ---');
      console.log(`Has Long-Term Care Insurance: ${profileToUse.hasLongTermCareInsurance ? 'Yes' : 'No'}`);
      console.log(`Life Insurance Coverage: $${(profileToUse as any).lifeInsuranceCoverage?.toLocaleString() || 0}`);
      console.log(`Disability Insurance: ${(profileToUse as any).hasDisabilityInsurance || profileToUse.disabilityInsurance ? 'Yes' : 'No'}`);
      
      console.log('\n--- INVESTMENT PREFERENCES ---');
      console.log(`Risk Profile: ${(profileToUse as any).riskProfile || 'Not specified'}`);
      console.log(`Current Allocation:`, profileToUse.currentAllocation || 'Not specified');
      console.log(`Target Allocation:`, (profileToUse as any).targetAllocation || 'Not specified');
      
      console.log('\n--- MONTE CARLO PARAMETERS ---');
      console.log('Parameters:', {
        currentAge: params.currentAge,
        retirementAge: params.retirementAge,
        lifeExpectancy: params.lifeExpectancy,
        yearsToRetirement: params.retirementAge - params.currentAge,
        currentRetirementAssets: params.currentRetirementAssets,
        annualGuaranteedIncome: params.annualGuaranteedIncome,
        annualRetirementExpenses: params.annualRetirementExpenses,
        annualSavings: params.annualSavings,
        withdrawalRate: params.withdrawalRate,
        stockAllocation: params.stockAllocation,
        bondAllocation: params.bondAllocation,
        cashAllocation: params.cashAllocation,
        legacyGoal: params.legacyGoal,
        hasLongTermCareInsurance: params.hasLongTermCareInsurance,
        taxRate: params.taxRate,
        retirementState: params.retirementState,
      });
      
      // Run Monte Carlo simulation
      const ITERATIONS = 1000; // Keep to manage latency
      console.log('\n=== BASELINE MONTE CARLO EXECUTION ===');
      console.log('Key Input Values:');
      console.log('  Annual Guaranteed Income: $', params.annualGuaranteedIncome.toLocaleString());
      console.log('  Annual Retirement Expenses: $', params.annualRetirementExpenses.toLocaleString());
      console.log('  Net Annual Withdrawal Needed: $', Math.max(0, params.annualRetirementExpenses - params.annualGuaranteedIncome).toLocaleString());
      console.log('  Current Retirement Assets: $', params.currentRetirementAssets.toLocaleString());
      console.log(`Starting Monte Carlo with ${ITERATIONS} iterations for visualization`);
      
      const enhanced = await mcPool.run({ params, simulationCount: ITERATIONS, type: 'score' });
      
      console.log('\n=== BASELINE MONTE CARLO RESULT ===');
      console.log('Success Probability:', ((enhanced.fullResult?.probabilityOfSuccess || (enhanced.successes / enhanced.total)) * 100).toFixed(1) + '%');
      if (enhanced.fullResult?.scenarios) {
        console.log('Successful Scenarios:', enhanced.fullResult.scenarios.successful, '/', enhanced.fullResult.scenarios.total);
      }
      console.log('Portfolio Values:');
      console.log('  Median Final Value: $', (enhanced.fullResult?.medianEndingBalance || enhanced.medianEndingBalance || 0).toLocaleString());
      console.log('  10th Percentile: $', (enhanced.fullResult?.confidenceIntervals?.percentile10 || enhanced.percentile10 || 0).toLocaleString());
      console.log('  90th Percentile: $', (enhanced.fullResult?.confidenceIntervals?.percentile90 || enhanced.percentile90 || 0).toLocaleString());

      // Store results in database (reduce payload size)
      const monteCarloData = {
        retirementSimulation: {
          calculatedAt: new Date().toISOString(),
          parameters: {
            // Store only essential parameters to reduce size
            currentAge: params.currentAge,
            retirementAge: params.retirementAge,
            lifeExpectancy: params.lifeExpectancy,
            currentRetirementAssets: params.currentRetirementAssets,
            annualGuaranteedIncome: params.annualGuaranteedIncome,
            annualRetirementExpenses: params.annualRetirementExpenses,
            annualSavings: params.annualSavings,
            stockAllocation: params.stockAllocation,
            bondAllocation: params.bondAllocation,
            hasLongTermCareInsurance: params.hasLongTermCareInsurance,
            taxRate: params.taxRate,
            retirementState: params.retirementState
          },
          results: {
            // Store only summary results to reduce database payload
            successProbability: enhanced.fullResult?.probabilityOfSuccess || (enhanced.successes / enhanced.total),
            probabilityOfSuccess: Math.round((enhanced.fullResult?.probabilityOfSuccess || (enhanced.successes / enhanced.total)) * 1000) / 10, // percentage with 1 decimal
            totalScenarios: enhanced.fullResult?.scenarios?.total || enhanced.total || ITERATIONS,
            successfulScenarios: enhanced.fullResult?.scenarios?.successful || enhanced.successes || Math.round((enhanced.fullResult?.probabilityOfSuccess || (enhanced.successes / enhanced.total)) * ITERATIONS),
            medianFinalValue: enhanced.fullResult?.medianEndingBalance || enhanced.medianEndingBalance || 0,
            percentile10: enhanced.fullResult?.confidenceIntervals?.percentile10 || enhanced.percentile10 || 0,
            percentile90: enhanced.fullResult?.confidenceIntervals?.percentile90 || enhanced.percentile90 || 0,
            averageDeficit: 0,
            averageSurplus: 0
          }
        }
      };

      // Try to update the database with retry logic
      try {
        await storage.updateFinancialProfile(userId, {
          monteCarloSimulation: monteCarloData
        });
        
        // Cache the results in widget cache system for fast retrieval
        await widgetCacheManager.cacheWidget(
          userId,
          'monte_carlo_retirement',
          inputHash,
          monteCarloData.retirementSimulation.results,
          24 // Cache for 24 hours
        );
        
        console.log('[MONTE-CARLO-CACHE] Monte Carlo results cached successfully');
      } catch (dbError: any) {
        // Log the database error but don't fail the entire calculation
        console.error('Failed to persist Monte Carlo results to database:', dbError);
        
        // Still return the results to the user even if we couldn't save them
        console.log('Returning Monte Carlo results without persisting to database');
      }
      
      // Analyze gaps and generate action items
      const gapAnalysis = analyzeRetirementGaps(params, enhanced as any, profile);
      
      // Calculate optimal retirement age
      let optimalRetirementAge = null;
      try {
        if (isStep11SufficientForOptimalAge(profileToUse)) {
          console.log('Calculating optimal retirement age for Monte Carlo widget...');
          optimalRetirementAge = await findOptimalRetirementAge(profileToUse, 80); // Target 80% success rate
          if (optimalRetirementAge) {
            console.log('Optimal retirement age calculated for widget:', optimalRetirementAge);
          }
        } else {
          console.log('Skipping optimal retirement age calculation - Step 11 incomplete (missing retirement age, expenses, or social security data)');
        }
      } catch (error) {
        console.error('Error calculating optimal retirement age for widget:', error);
      }
      
      // Generate cash flow data for portfolio projections from Monte Carlo percentiles
      let yearlyCashFlows, percentile10CashFlows, percentile90CashFlows;
      try {
        // Fallback: use median scenario from enhanced.allScenarios when available
        const scenarios = (enhanced as any).allScenarios as Array<any> | undefined;
        if (scenarios && scenarios.length > 0) {
          const sorted = [...scenarios].sort((a, b) => (a.endingBalance || 0) - (b.endingBalance || 0));
          const medianIdx = Math.floor(sorted.length / 2);
          const p10Idx = Math.floor(sorted.length * 0.10);
          const p90Idx = Math.floor(sorted.length * 0.90);
          yearlyCashFlows = sorted[medianIdx]?.yearlyCashFlows || [];
          percentile10CashFlows = sorted[p10Idx]?.yearlyCashFlows || [];
          percentile90CashFlows = sorted[p90Idx]?.yearlyCashFlows || [];
        } else {
          // As a last resort, provide the aggregated yearlyCashFlows stream if present
          yearlyCashFlows = (enhanced as any).yearlyCashFlows || [];
          percentile10CashFlows = [];
          percentile90CashFlows = [];
        }
      } catch (error) {
        console.error('Error selecting Monte Carlo percentile cash flows:', error);
        yearlyCashFlows = (enhanced as any).yearlyCashFlows || [];
        percentile10CashFlows = [];
        percentile90CashFlows = [];
      }
      
      // Enhanced response with expense and healthcare breakdown
      // Compute probability consistently from fullResult or successes/total
      const probabilityDecimal = Math.max(0, Math.min(1,
        (enhanced?.fullResult?.probabilityOfSuccess ?? ((enhanced?.successes || 0) / Math.max(1, enhanced?.total || 0)))
      ));
      const probabilityPct = Math.round(probabilityDecimal * 100);

      const enhancedResult = {
        // Transform enhanced to match expected frontend interface
        probabilityOfSuccess: probabilityPct, // 0-100 for display
        medianEndingBalance: enhanced.fullResult?.medianEndingBalance || enhanced.medianEndingBalance || 0,
        percentile10EndingBalance: enhanced.fullResult?.confidenceIntervals?.percentile10 || enhanced.confidenceIntervals?.percentile10 || 0,
        percentile90EndingBalance: enhanced.fullResult?.confidenceIntervals?.percentile90 || enhanced.confidenceIntervals?.percentile90 || 0,
        yearsUntilDepletion: null, // Not calculated in current implementation
        safeWithdrawalRate: 0.04, // Default value from params
        currentRetirementAssets: params.currentRetirementAssets,
        projectedRetirementPortfolio: params.currentRetirementAssets, // Simplified for now
        scenarios: {
          successful: Math.round(probabilityDecimal * (enhanced?.total || ITERATIONS)),
          failed: (enhanced?.total || ITERATIONS) - Math.round(probabilityDecimal * (enhanced?.total || ITERATIONS)),
          total: enhanced?.total || ITERATIONS
        },
        confidenceIntervals: {
          percentile10: enhanced.fullResult?.confidenceIntervals?.percentile10 || enhanced.confidenceIntervals?.percentile10 || 0,
          percentile25: enhanced.fullResult?.confidenceIntervals?.percentile25 || enhanced.confidenceIntervals?.percentile25 || 0,
          percentile50: enhanced.fullResult?.medianEndingBalance || enhanced.medianEndingBalance || 0,
          percentile75: enhanced.fullResult?.confidenceIntervals?.percentile75 || enhanced.confidenceIntervals?.percentile75 || 0,
          percentile90: enhanced.fullResult?.confidenceIntervals?.percentile90 || enhanced.confidenceIntervals?.percentile90 || 0
        },
        // Add raw simulation results for visualization
        results: enhanced.fullResult?.results || enhanced.results || [],
        summary: enhanced.fullResult?.summary || enhanced.summary || {},
        successProbability: probabilityDecimal, // 0-1 internal
        expenseBreakdown: {
          // Treat total expenses as base living + healthcare
          totalExpensesNeeded: (params.annualRetirementExpenses + (params.annualHealthcareCosts || 0)),
          guaranteedIncome: params.annualGuaranteedIncome,
          netWithdrawalNeeded: Math.max(0, (params.annualRetirementExpenses + (params.annualHealthcareCosts || 0)) - params.annualGuaranteedIncome),
          monthlyExpenses: (params.annualRetirementExpenses + (params.annualHealthcareCosts || 0)) / 12,
          monthlyGuaranteedIncome: params.annualGuaranteedIncome / 12,
          monthlyNetWithdrawal: Math.max(0, (params.annualRetirementExpenses + (params.annualHealthcareCosts || 0)) - params.annualGuaranteedIncome) / 12,
          // Healthcare breakdown
          annualHealthcareCosts: params.annualHealthcareCosts,
          monthlyHealthcareCosts: params.annualHealthcareCosts ? params.annualHealthcareCosts / 12 : 0,
          healthcarePercentage: (params.annualHealthcareCosts && (params.annualRetirementExpenses + (params.annualHealthcareCosts || 0)) > 0) ?
            (params.annualHealthcareCosts / (params.annualRetirementExpenses + (params.annualHealthcareCosts || 0)) * 100) : 0,
          healthcareInflationRate: params.healthcareInflationRate ? params.healthcareInflationRate * 100 : 2.69
        },
        // Include gap analysis with action items
        gapAnalysis: {
          currentScore: gapAnalysis.currentScore,
          targetScore: gapAnalysis.targetScore,
          gap: gapAnalysis.gap,
          topFactors: gapAnalysis.topFactors
        },
        // Include optimal retirement age
        optimalRetirementAge,
        // Include cash flow data for portfolio projections
        yearlyCashFlows: yearlyCashFlows || [],
        percentile10CashFlows: percentile10CashFlows || [],
        percentile90CashFlows: percentile90CashFlows || []
      };
      
      // Set cache prevention headers to ensure fresh calculations
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      
      console.log('API Response - Monte Carlo Data:', {
        hasResults: !!enhancedResult.results,
        resultsLength: enhancedResult.results?.length || 0,
        hasYearlyData: enhancedResult.results?.[0]?.yearlyData ? true : false,
        scenarios: enhancedResult.scenarios,
        probabilityOfSuccess: enhancedResult.probabilityOfSuccess
      });
      
      // Add timestamp to the result
      const engineVersion = process.env.MC_ENGINE_VERSION || 'enhanced-mc-1.0';
      const resultWithTimestamp = {
        ...enhancedResult,
        calculatedAt: new Date().toISOString(),
        isCached: false,
        metadata: {
          seed,
          correlationId,
          engineVersion
        }
      };
      
      // Cache the result in Redis for 1 hour (3600 seconds) - ONLY if not skipping cache
      if (!skipCache) {
        const cacheKey = {
          userId,
          profileUpdatedAt: profile.lastUpdated,
          age: profileToUse.dateOfBirth ? new Date().getFullYear() - new Date(profileToUse.dateOfBirth).getFullYear() : 30,
          annualIncome: profileToUse.annualIncome,
          retirementAge: profileToUse.desiredRetirementAge || profileToUse.retirementAge,
          monthlyExpenses: profileToUse.expectedMonthlyExpensesRetirement,
          socialSecurityBenefit: profileToUse.socialSecurityBenefit,
          expectedReturn: profileToUse.expectedRealReturn,
          maritalStatus: profileToUse.maritalStatus,
          spouseIncome: profileToUse.spouseAnnualIncome,
          spouseBenefit: profileToUse.spouseSocialSecurityBenefit
        };
        await cacheService.set(`monte_carlo:${userId}`, cacheKey, resultWithTimestamp, 3600);
        console.log('[Redis Cache] Cached Monte Carlo results for 1 hour');
      }
      
      // Save a compact result to the database to avoid oversized JSON and preserve persistence
      try {
        const totalScenarios = Number(enhancedResult?.scenarios?.total || 1000);
        const successfulScenarios = Math.round(Number(enhancedResult?.probabilityOfSuccess || 0) * totalScenarios / 100);
        const compactResults = {
          successProbability: Number(enhancedResult?.probabilityOfSuccess || 0) / 100, // store decimal
          probabilityOfSuccess: Number(enhancedResult?.probabilityOfSuccess || 0) / 100, // decimal
          totalScenarios,
          successfulScenarios,
          medianFinalValue: Number(enhancedResult?.medianEndingBalance || 0),
          percentile10: Number(enhancedResult?.confidenceIntervals?.percentile10 || 0),
          percentile90: Number(enhancedResult?.confidenceIntervals?.percentile90 || 0),
          yearlyCashFlows: []
        };
        await storage.updateFinancialProfile(userId, {
          monteCarloSimulation: {
            retirementSimulation: {
              calculatedAt: resultWithTimestamp.calculatedAt,
              parameters: params,
              // Include key fields at wrapper level for backward compatibility
              probabilityOfSuccess: compactResults.probabilityOfSuccess,
              medianEndingBalance: compactResults.medianFinalValue,
              scenarios: { total: totalScenarios, successful: successfulScenarios },
              // Compact results only
              results: compactResults,
            }
          }
        });
        console.log('Monte Carlo compact results saved to database for caching');
      } catch (saveError) {
        console.error('Failed to save Monte Carlo results for caching:', saveError);
        // Don't fail the request if caching fails
      }
      
      res.json(resultWithTimestamp);
    } catch (error) {
      console.error('Error calculating retirement Monte Carlo:', error);
      console.error('Error stack:', error.stack);
      
      // Return a proper error response instead of passing to next()
      res.status(500).json({
        error: 'Failed to calculate Monte Carlo simulation',
        message: error.message || 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Enhanced Monte Carlo simulation with baseline algorithm and LTC modeling
  app.post("/api/calculate-retirement-monte-carlo-enhanced", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const skipCache = req.body?.skipCache === true; // Default to using cache unless explicitly skipped
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;
      
      // Get the user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      // Check if retirement planning data is complete
      const requiredRetirementFields = [
        'desiredRetirementAge',
        'expectedMonthlyExpensesRetirement',
        'socialSecurityClaimAge',
        'socialSecurityBenefit'
      ];
      
      const missingFields = requiredRetirementFields.filter(field => !profile[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          error: "Retirement planning data incomplete.",
          message: "Click refresh to calculate your retirement confidence score using your saved intake form data.",
          missingFields,
          requiresStep: 11
        });
      }
      
      // Check for cached enhanced results if not skipping cache
      if (!skipCache && profile.calculations?.retirementConfidenceScoreEnhanced) {
        const cachedResult = profile.calculations.retirementConfidenceScoreEnhanced;
        const cacheAge = Date.now() - (cachedResult.calculatedAt || 0);
        const maxCacheAge = 60 * 60 * 1000; // 1 hour
        
        if (cacheAge < maxCacheAge) {
          console.log('Returning cached enhanced Monte Carlo results');
          return res.json(cachedResult);
        }
      }
      
      // Import the enhanced Monte Carlo function and conversion helper
      const { runEnhancedMonteCarloSimulation } = await import("./monte-carlo-enhanced.js");
      const { profileToRetirementParams } = await import("./monte-carlo-base.js");

      // Run enhanced Monte Carlo with baseline configuration
      console.log('Running enhanced Monte Carlo simulation with baseline algorithm and LTC modeling');
      const params = profileToRetirementParams(profile);
      // Enable nominal dollars in params for this endpoint
      (params as any).useNominalDollars = true;
      const enhancedResult = await mcPool.run({ 
        params, 
        simulationCount: 1000, 
        type: 'score' 
      });
      
      const resultWithTimestamp = {
        ...enhancedResult.fullResult,
        calculatedAt: Date.now(),
        algorithm: 'enhanced-baseline-ltc'
      };
      
      // Save enhanced results to database
      try {
        await storage.updateFinancialProfile(userId, {
          calculations: {
            ...profile.calculations,
            retirementConfidenceScoreEnhanced: resultWithTimestamp
          }
        });
        console.log('Enhanced Monte Carlo results saved to database');
      } catch (saveError) {
        console.error('Failed to save enhanced Monte Carlo results:', saveError);
      }
      
      res.json(resultWithTimestamp);
    } catch (error) {
      console.error('Error calculating enhanced Monte Carlo:', error);
      res.status(500).json({
        error: 'Failed to calculate enhanced Monte Carlo simulation',
        message: error.message || 'An unexpected error occurred'
      });
    }
  });

  // Optimize retirement score with custom variables
  app.post("/api/optimize-retirement-score", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const variables = req.body;
      
      // Enhanced logging for debugging
      console.log('\n=== OPTIMIZATION REQUEST RECEIVED ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('User ID:', userId);
      console.log('Variables received:', JSON.stringify(variables, null, 2));
      
      // Get the user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      // Enhance profile with Plaid retirement data
      let enhancedProfile = { ...profile };
      try {
        const { PlaidDataAggregator } = await import('./services/plaid-data-aggregator');
        
        // Get retirement accounts from Plaid
        const retirementData = await PlaidDataAggregator.getRetirementAccounts(userId);
        
        // Get complete financial picture
        const financialData = await PlaidDataAggregator.getUserCompleteFinancialPicture(userId);
        
        if (retirementData && retirementData.breakdown) {
          console.log('=== PLAID RETIREMENT DATA FOR OPTIMIZATION ===');
          console.log('Total Plaid Retirement Assets:', retirementData.breakdown.total);
          console.log('401k Balance:', retirementData.breakdown.traditional401k + retirementData.breakdown.roth401k);
          console.log('IRA Balance:', retirementData.breakdown.traditionalIRA + retirementData.breakdown.rothIRA);
          
          // Update assets with Plaid data
          const assets = enhancedProfile.assets || [];
          
          // Update 401k balances
          if (retirementData.breakdown.traditional401k > 0 || retirementData.breakdown.roth401k > 0) {
            const total401k = retirementData.breakdown.traditional401k + retirementData.breakdown.roth401k;
            const existing401k = assets.find((a: any) => a.type === '401k');
            if (existing401k) {
              existing401k.value = total401k;
              existing401k.plaidEnhanced = true;
            } else {
              assets.push({
                type: '401k',
                value: total401k,
                owner: 'user',
                plaidEnhanced: true
              });
            }
          }
          
          // Update IRA balances
          if (retirementData.breakdown.traditionalIRA > 0) {
            const existingIRA = assets.find((a: any) => a.type === 'traditional-ira');
            if (existingIRA) {
              existingIRA.value = retirementData.breakdown.traditionalIRA;
              existingIRA.plaidEnhanced = true;
            } else {
              assets.push({
                type: 'traditional-ira',
                value: retirementData.breakdown.traditionalIRA,
                owner: 'user',
                plaidEnhanced: true
              });
            }
          }
          
          if (retirementData.breakdown.rothIRA > 0) {
            const existingRoth = assets.find((a: any) => a.type === 'roth-ira');
            if (existingRoth) {
              existingRoth.value = retirementData.breakdown.rothIRA;
              existingRoth.plaidEnhanced = true;
            } else {
              assets.push({
                type: 'roth-ira',
                value: retirementData.breakdown.rothIRA,
                owner: 'user',
                plaidEnhanced: true
              });
            }
          }
          
          enhancedProfile.assets = assets;
          
          // Extract contribution amounts from recent transactions if available
          if (financialData && financialData.plaidAccounts) {
            // Look for recurring 401k contributions in transactions
            // This would require analyzing transaction patterns
            console.log('Plaid accounts available for contribution analysis:', financialData.plaidAccounts.length);
          }
        }
      } catch (plaidError) {
        console.log('Plaid data not available for optimization, using manual data only');
      }

      // Log baseline profile values for comparison
      console.log('\n=== BASELINE PROFILE VALUES ===');
      console.log('Social Security Benefit:', enhancedProfile.socialSecurityBenefit);
      console.log('Spouse SS Benefit:', enhancedProfile.spouseSocialSecurityBenefit);
      console.log('Pension Benefit:', enhancedProfile.pensionBenefit);
      console.log('Spouse Pension:', enhancedProfile.spousePensionBenefit);
      console.log('Part-time Income:', enhancedProfile.partTimeIncomeRetirement);
      console.log('Spouse Part-time:', enhancedProfile.spousePartTimeIncomeRetirement);
      console.log('Monthly Expenses:', enhancedProfile.expectedMonthlyExpensesRetirement);
      console.log('LTC Insurance:', enhancedProfile.hasLongTermCareInsurance);
      
      // Create a modified profile with optimization variables
      const optimizedProfile = { ...enhancedProfile };
      
      // Apply retirement ages
      if (variables.retirementAge !== undefined) {
        optimizedProfile.desiredRetirementAge = variables.retirementAge;
      }
      if (variables.spouseRetirementAge !== undefined) {
        optimizedProfile.spouseDesiredRetirementAge = variables.spouseRetirementAge;
      }
      
      // Apply Social Security claim ages and benefits
      if (variables.socialSecurityAge !== undefined) {
        optimizedProfile.socialSecurityClaimAge = variables.socialSecurityAge;
        
        // If a specific benefit amount is provided, use it directly
        // Otherwise, recalculate based on claim age
        if (variables.socialSecurityBenefit !== undefined && variables.socialSecurityBenefit > 0) {
          optimizedProfile.socialSecurityBenefit = variables.socialSecurityBenefit;
          console.log('Using provided SS benefit:', variables.socialSecurityBenefit);
        } else {
          // Recalculate Social Security benefit based on new claim age
          const currentAge = optimizedProfile.dateOfBirth 
            ? new Date().getFullYear() - new Date(optimizedProfile.dateOfBirth).getFullYear() 
            : 30;
          
          // Calculate AIME and PIA (AIME expects MONTHLY income)
          const monthlyIncome = (optimizedProfile.annualIncome || 0) / 12;
          const userAIME = calculateAIME(monthlyIncome, currentAge, 67);
          const userPIA = calculatePrimaryInsuranceAmount(userAIME);
          
          // Calculate benefit at the chosen claim age
          const adjustedBenefit = calculateBenefitAtAge(variables.socialSecurityAge, 67, userPIA);
          optimizedProfile.socialSecurityBenefit = adjustedBenefit;
          console.log('Calculated SS benefit:', adjustedBenefit, 'at age', variables.socialSecurityAge);
        }
      }
      
      if (variables.spouseSocialSecurityAge !== undefined) {
        optimizedProfile.spouseSocialSecurityClaimAge = variables.spouseSocialSecurityAge;
        
        // Recalculate spouse Social Security benefit if married/partnered
        if ((optimizedProfile.maritalStatus === 'married' || optimizedProfile.maritalStatus === 'partnered')) {
          // If a specific benefit amount is provided, use it directly
          if (variables.spouseSocialSecurityBenefit !== undefined && variables.spouseSocialSecurityBenefit > 0) {
            optimizedProfile.spouseSocialSecurityBenefit = variables.spouseSocialSecurityBenefit;
            console.log('Using provided spouse SS benefit:', variables.spouseSocialSecurityBenefit);
          } else if (optimizedProfile.spouseAnnualIncome) {
            const spouseAge = optimizedProfile.spouseDateOfBirth 
              ? new Date().getFullYear() - new Date(optimizedProfile.spouseDateOfBirth).getFullYear() 
              : 30;
            
            // Calculate spouse AIME and PIA (AIME expects MONTHLY income)
            const spouseMonthlyIncome = (optimizedProfile.spouseAnnualIncome || 0) / 12;
            const spouseAIME = calculateAIME(spouseMonthlyIncome, spouseAge, 67);
            const spousePIA = calculatePrimaryInsuranceAmount(spouseAIME);
            
            // Calculate spouse benefit at the chosen claim age
            const adjustedSpouseBenefit = calculateBenefitAtAge(variables.spouseSocialSecurityAge, 67, spousePIA);
            optimizedProfile.spouseSocialSecurityBenefit = adjustedSpouseBenefit;
            console.log('Calculated spouse SS benefit:', adjustedSpouseBenefit, 'at age', variables.spouseSocialSecurityAge);
          }
        }
      }
      
      // Apply asset allocation strategy for user
      if (variables.assetAllocation === 'current-allocation') {
        optimizedProfile.expectedRealReturn = -2; // Special value for current allocation
      } else if (variables.assetAllocation === 'glide-path') {
        optimizedProfile.expectedRealReturn = -1; // Special value for glide path
      } else if (variables.assetAllocation) {
        // Keep as percentage - profileToRetirementParams will convert to decimal
        optimizedProfile.expectedRealReturn = parseFloat(variables.assetAllocation) / 100; // Convert percentage to decimal
      }
      
      // Apply asset allocation strategy for spouse
      if (variables.spouseAssetAllocation === 'current-allocation') {
        optimizedProfile.spouseExpectedRealReturn = -2; // Special value for current allocation
      } else if (variables.spouseAssetAllocation === 'glide-path') {
        optimizedProfile.spouseExpectedRealReturn = -1; // Special value for glide path
      } else if (variables.spouseAssetAllocation) {
        // Keep as percentage - profileToRetirementParams will convert to decimal
        // Normalize to decimal here for consistency with user allocation handling
        optimizedProfile.spouseExpectedRealReturn = parseFloat(variables.spouseAssetAllocation) / 100;
      }
      
      // Apply retirement contributions using separate fields (matching intake form Step 11)
      // User 401k/403b contributions (monthly values)
      if (variables.monthlyEmployee401k !== undefined || variables.monthlyEmployer401k !== undefined) {
        optimizedProfile.retirementContributions = {
          employee: variables.monthlyEmployee401k ?? (optimizedProfile.retirementContributions?.employee || 0),
          employer: variables.monthlyEmployer401k ?? (optimizedProfile.retirementContributions?.employer || 0)
        };
      }
      
      // User IRA contributions (annual values)
      if (variables.annualTraditionalIRA !== undefined) {
        optimizedProfile.traditionalIRAContribution = variables.annualTraditionalIRA;
      }
      if (variables.annualRothIRA !== undefined) {
        optimizedProfile.rothIRAContribution = variables.annualRothIRA;
      }
      
      // Spouse 401k/403b contributions (monthly values)
      if (variables.spouseMonthlyEmployee401k !== undefined || variables.spouseMonthlyEmployer401k !== undefined) {
        optimizedProfile.spouseRetirementContributions = {
          employee: variables.spouseMonthlyEmployee401k ?? (optimizedProfile.spouseRetirementContributions?.employee || 0),
          employer: variables.spouseMonthlyEmployer401k ?? (optimizedProfile.spouseRetirementContributions?.employer || 0)
        };
      }
      
      // Spouse IRA contributions (annual values)
      if (variables.spouseAnnualTraditionalIRA !== undefined) {
        optimizedProfile.spouseTraditionalIRAContribution = variables.spouseAnnualTraditionalIRA;
      }
      if (variables.spouseAnnualRothIRA !== undefined) {
        optimizedProfile.spouseRothIRAContribution = variables.spouseAnnualRothIRA;
      }
      
      // Apply monthly expenses
      if (variables.monthlyExpenses !== undefined) {
        optimizedProfile.expectedMonthlyExpensesRetirement = variables.monthlyExpenses;
      }
      
      // Apply part-time income
      if (variables.partTimeIncome !== undefined) {
        optimizedProfile.partTimeIncomeRetirement = variables.partTimeIncome;
      }
      if (variables.spousePartTimeIncome !== undefined) {
        optimizedProfile.spousePartTimeIncomeRetirement = variables.spousePartTimeIncome;
      }
      
      // Apply pension benefits if provided
      if (variables.pensionBenefit !== undefined) {
        optimizedProfile.pensionBenefit = variables.pensionBenefit;
        console.log('Applied pension benefit:', variables.pensionBenefit);
      }
      if (variables.spousePensionBenefit !== undefined) {
        optimizedProfile.spousePensionBenefit = variables.spousePensionBenefit;
        console.log('Applied spouse pension benefit:', variables.spousePensionBenefit);
      }
      
      // Apply Long-Term Care Insurance
      if (variables.hasLongTermCareInsurance !== undefined) {
        optimizedProfile.hasLongTermCareInsurance = variables.hasLongTermCareInsurance;
        console.log('Applied LTC insurance:', variables.hasLongTermCareInsurance);
      }
      
      // Ensure any precomputed aggregate income fields don't double-count
      // We always derive guaranteed income from the monthly sources above
      delete (optimizedProfile as any).annualGuaranteedIncome;

      // Convert the optimized profile to Monte Carlo parameters
      const params = profileToRetirementParams(optimizedProfile);
      
      console.log('\n=== OPTIMIZATION VARIABLES APPLIED ===');
      console.log('Retirement Ages:', {
        user: variables.retirementAge,
        spouse: variables.spouseRetirementAge
      });
      console.log('Social Security:', {
        userClaimAge: variables.socialSecurityAge,
        userBenefit: optimizedProfile.socialSecurityBenefit,
        spouseClaimAge: variables.spouseSocialSecurityAge,
        spouseBenefit: optimizedProfile.spouseSocialSecurityBenefit
      });
      console.log('Pensions:', {
        user: optimizedProfile.pensionBenefit,
        spouse: optimizedProfile.spousePensionBenefit
      });
      console.log('Contributions:', {
        userMonthly401k: variables.monthlyEmployee401k,
        userEmployerMatch: variables.monthlyEmployer401k,
        userTraditionalIRA: variables.annualTraditionalIRA,
        userRothIRA: variables.annualRothIRA,
        spouseMonthly401k: variables.spouseMonthlyEmployee401k,
        spouseEmployerMatch: variables.spouseMonthlyEmployer401k,
        spouseTraditionalIRA: variables.spouseAnnualTraditionalIRA,
        spouseRothIRA: variables.spouseAnnualRothIRA
      });
      console.log('Other Settings:', {
        monthlyExpenses: variables.monthlyExpenses,
        partTimeIncome: variables.partTimeIncome,
        spousePartTimeIncome: variables.spousePartTimeIncome,
        hasLongTermCareInsurance: variables.hasLongTermCareInsurance,
        assetAllocation: variables.assetAllocation,
        spouseAssetAllocation: variables.spouseAssetAllocation
      });
      
      console.log('\n=== RESULTING MONTE CARLO PARAMETERS ===');
      console.log('Ages:', {
        currentAge: params.currentAge,
        retirementAge: params.retirementAge,
        spouseAge: params.spouseAge,
        spouseRetirementAge: params.spouseRetirementAge,
        lifeExpectancy: params.lifeExpectancy,
        spouseLifeExpectancy: params.spouseLifeExpectancy
      });
      console.log('Income & Expenses:', {
        annualGuaranteedIncome: params.annualGuaranteedIncome,
        annualRetirementExpenses: params.annualRetirementExpenses,
        monthlyGuaranteed: params.annualGuaranteedIncome / 12,
        monthlyExpenses: params.annualRetirementExpenses / 12
      });
      console.log('Savings & Assets:', {
        currentRetirementAssets: params.currentRetirementAssets,
        annualSavings: params.annualSavings,
        userAnnualSavings: params.userAnnualSavings,
        spouseAnnualSavings: params.spouseAnnualSavings
      });
      console.log('Investment Strategy:', {
        expectedReturn: params.expectedReturn,
        returnVolatility: params.returnVolatility,
        useGlidePath: params.useGlidePath,
        useRiskProfile: params.useRiskProfile
      });
      console.log('Tax & Other:', {
        taxRate: params.taxRate,
        hasLongTermCareInsurance: params.hasLongTermCareInsurance
      });
      
      // Run Monte Carlo simulation with optimized parameters (enhanced engine)
      const optimizedResult = await runEnhancedMonteCarloSimulation(params, 1000);
      
      // Transform Monte Carlo results to cash flow data for both optimized and baseline scenarios
      const { transformMonteCarloToCashFlow } = await import("./cash-flow-transformer");
      
      // Transform optimized cash flow data
      const optimizedCashFlow = transformMonteCarloToCashFlow(
        optimizedResult.yearlyCashFlows || [],
        {
          retirementAge: optimizedProfile.desiredRetirementAge || variables.retirementAge || 67,
          spouseRetirementAge: optimizedProfile.spouseDesiredRetirementAge || variables.spouseRetirementAge || 67,
          socialSecurityAge: optimizedProfile.socialSecurityClaimAge || variables.socialSecurityAge || 67,
          spouseSocialSecurityAge: optimizedProfile.spouseSocialSecurityClaimAge || variables.spouseSocialSecurityAge || 67,
          monthlyExpenses: optimizedProfile.expectedMonthlyExpensesRetirement || variables.monthlyExpenses || 8000,
          partTimeIncome: optimizedProfile.partTimeIncomeRetirement || variables.partTimeIncome || 0,
          spousePartTimeIncome: optimizedProfile.spousePartTimeIncomeRetirement || variables.spousePartTimeIncome || 0
        },
        optimizedProfile,
        true // isOptimized flag
      );
      
      console.log('✅ Optimized cash flow data transformed:', optimizedCashFlow.length, 'years');
      
      // Calculate baseline for comparison if variables were changed
      const hasChanges = Object.keys(variables).some(key => 
        variables[key] !== undefined && variables[key] !== null
      );
      
      let sensitivityAnalysis = null;
      let baselineCashFlow = null;
      
      if (hasChanges) {
        // Run baseline simulation with original profile for comparison
        const baselineParams = profileToRetirementParams(profile);
        const baselineResult = await runEnhancedMonteCarloSimulation(baselineParams, 1000);
        
        // Transform baseline cash flow data
        baselineCashFlow = transformMonteCarloToCashFlow(
          baselineResult.yearlyCashFlows || [],
          {
            retirementAge: profile.desiredRetirementAge || 67,
            spouseRetirementAge: profile.spouseDesiredRetirementAge || 67,
            socialSecurityAge: profile.socialSecurityClaimAge || 67,
            spouseSocialSecurityAge: profile.spouseSocialSecurityClaimAge || 67,
            monthlyExpenses: profile.expectedMonthlyExpensesRetirement || 8000,
            partTimeIncome: profile.partTimeIncomeRetirement || 0,
            spousePartTimeIncome: profile.spousePartTimeIncomeRetirement || 0
          },
          profile,
          false // isOptimized flag
        );
        
        console.log('✅ Baseline cash flow data transformed:', baselineCashFlow.length, 'years');
        
        // Calculate sensitivity impacts
        sensitivityAnalysis = {
          baselineSuccess: baselineResult.successProbability,
          optimizedSuccess: optimizedResult.successProbability,
          absoluteChange: optimizedResult.successProbability - baselineResult.successProbability,
          relativeChange: ((optimizedResult.successProbability - baselineResult.successProbability) / baselineResult.successProbability * 100).toFixed(2) + '%',
          variableImpacts: {}
        };
        
        // Track individual variable impacts
        if (variables.retirementAge !== undefined && profile.desiredRetirementAge !== variables.retirementAge) {
          const yearsDiff = variables.retirementAge - (profile.desiredRetirementAge || 65);
          sensitivityAnalysis.variableImpacts.retirementAge = {
            change: yearsDiff,
            expectedImpact: yearsDiff * 5,
            unit: 'years'
          };
        }
        
        if (variables.socialSecurityAge !== undefined && profile.socialSecurityClaimAge !== variables.socialSecurityAge) {
          const yearsDiff = variables.socialSecurityAge - (profile.socialSecurityClaimAge || 67);
          sensitivityAnalysis.variableImpacts.socialSecurityAge = {
            change: yearsDiff,
            expectedImpact: yearsDiff * 8,
            unit: 'years'
          };
        }
        
        if (variables.monthlyExpenses !== undefined && profile.expectedMonthlyExpensesRetirement !== variables.monthlyExpenses) {
          const percentChange = ((variables.monthlyExpenses - (profile.expectedMonthlyExpensesRetirement || 0)) / 
                                (profile.expectedMonthlyExpensesRetirement || 1)) * 100;
          sensitivityAnalysis.variableImpacts.monthlyExpenses = {
            change: percentChange.toFixed(1),
            expectedImpact: -percentChange * 0.5,
            unit: 'percent'
          };
        }
      }
      
      // Include sensitivity analysis in response
      const response = {
        ...optimizedResult,
        probabilityOfSuccess: optimizedResult.successProbability * 100, // Convert to percentage for frontend
        sensitivityAnalysis
      };
      
      // Save optimization results to database
      try {
        // Prepare cash flow data for storage
        let cashFlowData = {
          optimizedCashFlow,
          baselineCashFlow: hasChanges ? baselineCashFlow : null,
          transformedAt: new Date().toISOString()
        };
        
        const existingRP = (profile as any).retirementPlanningData || {};
        const optimizationData = {
          optimizationVariables: {
            ...variables,
            lockedAt: new Date().toISOString(),
            // Store only compact summary for score
            optimizedScore: {
              probabilityOfSuccess: optimizedResult?.successProbability,
              medianEndingBalance: optimizedResult?.medianEndingBalance,
              percentileData: {
                p05: optimizedResult?.percentileData?.p05,
                p10: optimizedResult?.percentileData?.p10,
                p25: optimizedResult?.percentileData?.p25,
                p50: optimizedResult?.percentileData?.p50,
                p75: optimizedResult?.percentileData?.p75,
                p90: optimizedResult?.percentileData?.p90,
                p95: optimizedResult?.percentileData?.p95,
              },
            },
            savedAt: new Date().toISOString()
          },
          
          // Also save Monte Carlo results separately
          monteCarloSimulation: {
            calculatedAt: new Date().toISOString(),
            probabilityOfSuccess: optimizedResult?.successProbability,
            medianEndingBalance: optimizedResult?.medianEndingBalance,
            percentileData: {
              p05: optimizedResult?.percentileData?.p05,
              p10: optimizedResult?.percentileData?.p10,
              p25: optimizedResult?.percentileData?.p25,
              p50: optimizedResult?.percentileData?.p50,
              p75: optimizedResult?.percentileData?.p75,
              p90: optimizedResult?.percentileData?.p90,
              p95: optimizedResult?.percentileData?.p95,
            },
            // Do NOT persist large arrays here; they can be cached or stored separately
            sensitivityAnalysis,
            // Avoid embedding large cash flow projections in the profile row
            cashFlowProjections: undefined
          },
          
          // Save retirement planning data (merge to preserve other cached subtrees like impactOnPortfolioBalance)
          retirementPlanningData: {
            ...existingRP,
            lastOptimizedAt: new Date().toISOString(),
            optimizationVariables: variables,
            optimizedScore: optimizedResult?.successProbability,
            baselineScore: sensitivityAnalysis?.baselineSuccess,
            improvement: sensitivityAnalysis?.absoluteChange
          }
        };
        
        await storage.updateFinancialProfile(userId, optimizationData);
        console.log('✅ Optimization results saved to database with cash flow projections:', {
          optimizedCashFlowYears: optimizedCashFlow.length,
          baselineCashFlowYears: baselineCashFlow ? baselineCashFlow.length : 0,
          hasComparison: hasChanges
        });
      } catch (saveError) {
        console.error('Failed to save optimization results:', saveError);
        // Don't fail the request if saving fails
      }
      
      res.json(response);
    } catch (error) {
      console.error('Error optimizing retirement score:', error);
      next(error);
    }
  });

  // Calculate optimized net worth projections

  // Helper functions for Social Security calculations - matching client-side implementation
  const calculateAIME = (annualIncome: number, currentAge: number, retirementAge: number): number => {
    // AIME is based on average monthly earnings over highest 35 years
    // For simplification, we'll use current income as a proxy for career average
    // and apply a factor to account for typical career earnings progression
    
    // Career progression factor: people typically earn less early in career
    let careerAverageFactor = 1.0;
    
    if (currentAge < 30) {
      careerAverageFactor = 0.7; // Early career typically lower earnings
    } else if (currentAge < 40) {
      careerAverageFactor = 0.85; // Mid-career progression
    } else if (currentAge < 50) {
      careerAverageFactor = 0.95; // Peak earning years
    } else {
      careerAverageFactor = 1.0; // Plateau/peak maintained
    }
    
    // Calculate estimated average annual income over career
    const estimatedCareerAverageIncome = annualIncome * careerAverageFactor;
    
    // Convert to monthly (AIME is Average Indexed MONTHLY Earnings)
    const aime = estimatedCareerAverageIncome / 12;
    
    // Cap at Social Security wage base (2025: $176,100/year = $14,675/month)
    const ssWageBase = 176100;
    const maxAIME = ssWageBase / 12;
    
    return Math.min(Math.round(aime), maxAIME);
  };

  const calculatePrimaryInsuranceAmount = (aime: number): number => {
    // 2025 bend points - matching client-side
    const firstBendPoint = 1226;
    const secondBendPoint = 7391;
    
    let pia = 0;
    
    if (aime <= firstBendPoint) {
      pia = aime * 0.90;
    } else if (aime <= secondBendPoint) {
      pia = firstBendPoint * 0.90 + (aime - firstBendPoint) * 0.32;
    } else {
      pia = firstBendPoint * 0.90 + (secondBendPoint - firstBendPoint) * 0.32 + (aime - secondBendPoint) * 0.15;
    }
    
    return Math.round(pia);
  };

  const calculateBenefitAtAge = (claimAge: number, fullRetirementAge: number, primaryInsuranceAmount: number): number => {
    if (claimAge < 62) return 0;
    if (claimAge > 70) claimAge = 70;
    
    // 2025 maximum monthly benefits per SSA
    const maxBenefits: { [key: number]: number } = {
      62: 2831,
      63: 3012,
      64: 3209,
      65: 3423,
      66: 3712,
      67: 4043,  // Full retirement age for those born 1960 or later
      68: 4366,
      69: 4712,
      70: 5108
    };
    
    let benefit: number;
    
    if (claimAge < fullRetirementAge) {
      // Early retirement reduction
      const monthsEarly = (fullRetirementAge - claimAge) * 12;
      let reduction = 0;
      
      if (monthsEarly <= 36) {
        // 5/9 of 1% per month for first 36 months
        reduction = monthsEarly * (5/9) / 100;
      } else {
        // 5/9 of 1% for first 36 months, then 5/12 of 1% for additional months
        reduction = 36 * (5/9) / 100 + (monthsEarly - 36) * (5/12) / 100;
      }
      
      benefit = primaryInsuranceAmount * (1 - reduction);
    } else if (claimAge > fullRetirementAge) {
      // Delayed retirement credits: 8% per year (2/3% per month)
      const monthsDelayed = Math.min((claimAge - fullRetirementAge) * 12, (70 - fullRetirementAge) * 12);
      const increase = monthsDelayed * (2/3) / 100;
      
      benefit = primaryInsuranceAmount * (1 + increase);
    } else {
      benefit = primaryInsuranceAmount;
    }
    
    // Apply maximum benefit cap based on claiming age
    const roundedAge = Math.round(claimAge);
    const maxBenefit = maxBenefits[roundedAge] || maxBenefits[70];
    
    return Math.min(Math.round(benefit), maxBenefit);
  };



  // POST /api/report/optimization-impact - Compute optimization impact on demand using same method as Optimization tab
  app.post('/api/report/optimization-impact', async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const profile = await storage.getFinancialProfile(userId);
      
      if (!profile) {
        return res.json({ impact: null, reason: 'no_profile' });
      }

      // Get variables from request body or use saved ones
      const variables = (req.body && req.body.variables) || (profile as any).optimizationVariables || {};

      // Use the same engine as the Optimization tab (current implementation)
      // Import the Monte Carlo withdrawal sequence generator
      const { calculateMonteCarloWithdrawalSequence } = await import('./monte-carlo-withdrawal-sequence');
      
      // Helper to read median balance from a flow item (matches client logic)
      const getMedianFromFlow = (flow: any): number => {
        if (!flow) return 0;
        if (typeof flow.portfolioBalance === 'number') return flow.portfolioBalance;
        if (flow.portfolioBalance?.p50 != null) return flow.portfolioBalance.p50;
        if (flow.totalBalance != null) return flow.totalBalance;
        if (flow.balance != null) return flow.balance;
        if (flow.p50 != null) return flow.p50;
        return 0;
      };

      // Calculate current age and retirement age
      const currentYear = new Date().getFullYear();
      const birthYear = profile.dateOfBirth ? new Date(profile.dateOfBirth).getFullYear() : currentYear - 35;
      const currentAge = currentYear - birthYear;
      const retirementAge = variables.retirementAge || profile.desiredRetirementAge || 65;
      
      // Calculate baseline projections (same as optimization tab)
      const baselineResult = await calculateMonteCarloWithdrawalSequence(
        profile,
        { startFromCurrentAge: true }
      );
      
      // Calculate optimized projections with variables
      const optimizedResult = await calculateMonteCarloWithdrawalSequence(
        profile,
        { ...variables, startFromCurrentAge: true }
      );
      
      // Build projection data from available structures (aligns with client fallback order)
      const maxAge = 92; // Align with Optimization tab display

      // Prefer yearlyCashFlows if present, otherwise use projections
      const baselineFlows: any[] = (baselineResult as any).yearlyCashFlows || (baselineResult as any).projections || [];
      const optimizedFlows: any[] = (optimizedResult as any).yearlyCashFlows || (optimizedResult as any).projections || [];

      const projectionData: Array<{ age: number; current: number; proposed: number }> = [];
      const maxLength = Math.max(baselineFlows.length, optimizedFlows.length);

      for (let i = 0; i < maxLength; i++) {
        const baselineFlow = baselineFlows[i];
        const optimizedFlow = optimizedFlows[i];

        if (baselineFlow || optimizedFlow) {
          const age = (baselineFlow?.age || optimizedFlow?.age) || retirementAge + i;
          if (age >= retirementAge && age <= maxAge) {
            const baselineValue = getMedianFromFlow(baselineFlow);
            const optimizedValue = getMedianFromFlow(optimizedFlow);
            projectionData.push({ age, current: baselineValue, proposed: optimizedValue });
          }
        }
      }
      
      // Get ending assets (last data point, same as optimization tab)
      const lastDataPoint = projectionData[projectionData.length - 1];
      const currentEndingAssets = lastDataPoint?.current || 0;
      const optimizedEndingAssets = lastDataPoint?.proposed || 0;
      const difference = optimizedEndingAssets - currentEndingAssets;
      
      // Return the impact value
      res.json({
        impact: difference,
        baselineBalance: currentEndingAssets,
        optimizedBalance: optimizedEndingAssets,
        retirementAge,
        currentAge,
        maxAge,
        hasOptimizationVariables: !!(variables && Object.keys(variables).length > 0),
        // Additional debug info
        yearsInRetirement: maxAge - retirementAge,
        projectionDataLength: projectionData.length
      });
      
    } catch (error) {
      console.error('report/optimization-impact error:', error);
      res.json({ impact: null, error: 'exception', message: (error as any).message });
    }
  });

  // Get retirement optimization suggestions using Gemini AI
  app.get("/api/retirement-optimization-suggestions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      
      // Get the user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }

      // Calculate optimal SS ages using existing logic from intake form
      const currentAge = profile.dateOfBirth 
        ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() 
        : 30;
      const spouseAge = profile.spouseDateOfBirth 
        ? new Date().getFullYear() - new Date(profile.spouseDateOfBirth).getFullYear() 
        : 30;

      // Social Security calculation functions (inline)
      const calculateAIME = (annualIncome: number, currentAge: number, retirementAge: number): number => {
        // Enhanced AIME calculation with wage growth (4% historical average)
        const careersStartAge = 22;
        const workingYears = Math.min(35, retirementAge - careersStartAge);
        
        // Calculate average career income with wage growth
        const yearsWorked = currentAge - careersStartAge;
        const yearsRemaining = Math.max(0, retirementAge - currentAge);
        
        let totalIndexedEarnings = 0;
        
        // Historical earnings (grown from estimated starting salary)
        const estimatedStartingSalary = annualIncome / Math.pow(1.04, yearsWorked / 2);
        for (let year = 0; year < yearsWorked; year++) {
          const yearlyIncome = estimatedStartingSalary * Math.pow(1.04, year);
          const cappedIncome = Math.min(yearlyIncome, 168600 * Math.pow(1.035, year - 25));
          totalIndexedEarnings += cappedIncome;
        }
        
        // Future earnings (with wage growth until retirement)
        for (let year = 0; year < yearsRemaining; year++) {
          const futureIncome = annualIncome * Math.pow(1.04, year);
          const futureWageBase = 168600 * Math.pow(1.035, year);
          const cappedIncome = Math.min(futureIncome, futureWageBase);
          totalIndexedEarnings += cappedIncome;
        }
        
        // AIME is average of highest 35 years, converted to monthly
        const totalYearsConsidered = Math.min(35, yearsWorked + yearsRemaining);
        const averageAnnualIncome = totalIndexedEarnings / totalYearsConsidered;
        const monthlyAIME = averageAnnualIncome / 12;
        
        return Math.round(monthlyAIME);
      };

      const calculatePrimaryInsuranceAmount = (aime: number): number => {
        // 2024 bend points
        const firstBend = 1174;
        const secondBend = 7078;
        
        let pia = 0;
        if (aime <= firstBend) {
          pia = aime * 0.9;
        } else if (aime <= secondBend) {
          pia = firstBend * 0.9 + (aime - firstBend) * 0.32;
        } else {
          pia = firstBend * 0.9 + (secondBend - firstBend) * 0.32 + (aime - secondBend) * 0.15;
        }
        
        return Math.round(pia);
      };

      const calculateOptimalSocialSecurityAge = (
        currentAge: number,
        fullRetirementAge: number,
        primaryInsuranceAmount: number,
        lifeExpectancy: number,
        discountRate: number
      ): { optimalClaimingAge: number; monthlyBenefitAtOptimal: number } => {
        let maxPV = 0;
        let optimalAge = fullRetirementAge;
        let benefitAtOptimal = primaryInsuranceAmount;
        
        // Test each possible claiming age from 62 to 70
        for (let claimAge = 62; claimAge <= 70; claimAge++) {
          const monthlyBenefit = calculateBenefitAtAge(claimAge, fullRetirementAge, primaryInsuranceAmount);
          const monthsOfBenefits = Math.max(0, (lifeExpectancy - claimAge) * 12);
          
          // Calculate present value of lifetime benefits
          let presentValue = 0;
          for (let month = 0; month < monthsOfBenefits; month++) {
            const yearsFromNow = (claimAge - currentAge) + (month / 12);
            const discountFactor = Math.pow(1 + discountRate, -yearsFromNow);
            presentValue += monthlyBenefit * discountFactor;
          }
          
          if (presentValue > maxPV) {
            maxPV = presentValue;
            optimalAge = claimAge;
            benefitAtOptimal = monthlyBenefit;
          }
        }
        
        return { optimalClaimingAge: optimalAge, monthlyBenefitAtOptimal: benefitAtOptimal };
      };

      const calculateBenefitAtAge = (claimAge: number, fullRetirementAge: number, primaryInsuranceAmount: number): number => {
        if (claimAge < 62 || claimAge > 70) return 0;
        
        let adjustmentFactor = 1;
        
        if (claimAge < fullRetirementAge) {
          // Early retirement reduction
          const monthsEarly = (fullRetirementAge - claimAge) * 12;
          const first36Months = Math.min(36, monthsEarly);
          const remainingMonths = Math.max(0, monthsEarly - 36);
          
          adjustmentFactor = 1 - (first36Months * 0.00555) - (remainingMonths * 0.00416);
        } else if (claimAge > fullRetirementAge) {
          // Delayed retirement credit (8% per year)
          const yearsDelayed = claimAge - fullRetirementAge;
          adjustmentFactor = 1 + (yearsDelayed * 0.08);
        }
        
        return Math.round(primaryInsuranceAmount * adjustmentFactor);
      };
      
      // Calculate optimal SS age for user
      const userAIME = calculateAIME(profile.annualIncome || 0, currentAge, 67);
      const userPIA = calculatePrimaryInsuranceAmount(userAIME);
      const userSSAnalysis = calculateOptimalSocialSecurityAge(
        currentAge,
        67,
        userPIA,
        profile.userLifeExpectancy || 93,
        0.03
      );

      // Calculate optimal SS age for spouse
      let spouseSSAnalysis = { optimalClaimingAge: 67 };
      if (profile.maritalStatus === 'married' && profile.spouseAnnualIncome) {
        const spouseAIME = calculateAIME(profile.spouseAnnualIncome, spouseAge, 67);
        const spousePIA = calculatePrimaryInsuranceAmount(spouseAIME);
        spouseSSAnalysis = calculateOptimalSocialSecurityAge(
          spouseAge,
          67,
          spousePIA,
          profile.spouseLifeExpectancy || 93,
          0.03
        );
      }

      // Get current Monte Carlo result
      const params = profileToRetirementParams(profile);
      const mcResult = await mcPool.run({ params, simulationCount: 1000, type: 'score' });
      const currentResult = mcResult.fullResult;

      // Generate AI suggestions using Gemini
      const suggestions = await generateRetirementOptimizationSuggestions(profile, currentResult, {
        userOptimalSSAge: userSSAnalysis.optimalClaimingAge,
        spouseOptimalSSAge: spouseSSAnalysis.optimalClaimingAge,
        currentAge,
        spouseAge
      });

      res.json({
        optimalSSAges: {
          user: userSSAnalysis.optimalClaimingAge,
          spouse: spouseSSAnalysis.optimalClaimingAge
        },
        suggestions
      });
    } catch (error) {
      console.error('Error getting optimization suggestions:', error);
      next(error);
    }
  });
  
  // Calculate net worth projections

  // Helper: apply optimization variables to the saved profile (non-destructive)
  function applyOptimizationVariablesToProfile(profile: any, variables: any) {
    const optimized = { ...profile };

    // Ages
    if (variables.retirementAge !== undefined) optimized.desiredRetirementAge = variables.retirementAge;
    if (variables.spouseRetirementAge !== undefined) optimized.spouseDesiredRetirementAge = variables.spouseRetirementAge;

    // Social Security claim ages
    if (variables.socialSecurityAge !== undefined) optimized.socialSecurityClaimAge = variables.socialSecurityAge;
    if (variables.spouseSocialSecurityAge !== undefined) optimized.spouseSocialSecurityClaimAge = variables.spouseSocialSecurityAge;

    // Asset allocation selection (consistent with intake Step 11)
    // 'glide-path' => -1, 'current-allocation' => -2, numeric (string) => percentage to decimal
    if (variables.assetAllocation) {
      optimized.expectedRealReturn =
        variables.assetAllocation === 'glide-path' ? -1 :
        variables.assetAllocation === 'current-allocation' ? -2 :
        isNaN(parseFloat(variables.assetAllocation)) ? optimized.expectedRealReturn :
        parseFloat(variables.assetAllocation) / 100;
    }
    if (variables.spouseAssetAllocation) {
      // For this projection we use a single expectedRealReturn; spouse is for MC/owner-specific flows.
      // You can extend net-worth-projections to use spouse later if needed.
    }

    // LTC
    if (typeof variables.hasLongTermCareInsurance === 'boolean') {
      optimized.hasLongTermCareInsurance = variables.hasLongTermCareInsurance;
    }

    // Contributions (map to Step 11 fields used by projections)
    if (variables.monthlyEmployee401k !== undefined) {
      optimized.monthlyContribution401k = variables.monthlyEmployee401k;
      optimized.retirementContributions = {
        ...optimized.retirementContributions,
        employee: variables.monthlyEmployee401k
      };
    }
    if (variables.monthlyEmployer401k !== undefined) {
      optimized.monthlyEmployerContribution401k = variables.monthlyEmployer401k;
      optimized.retirementContributions = {
        ...optimized.retirementContributions,
        employer: variables.monthlyEmployer401k
      };
    }
    if (variables.annualTraditionalIRA !== undefined) optimized.traditionalIRAContribution = variables.annualTraditionalIRA;
    if (variables.annualRothIRA !== undefined) optimized.rothIRAContribution = variables.annualRothIRA;

    if (variables.spouseMonthlyEmployee401k !== undefined) {
      optimized.spouseMonthlyContribution401k = variables.spouseMonthlyEmployee401k;
      optimized.spouseRetirementContributions = {
        ...optimized.spouseRetirementContributions,
        employee: variables.spouseMonthlyEmployee401k
      };
    }
    if (variables.spouseMonthlyEmployer401k !== undefined) {
      optimized.spouseMonthlyEmployerContribution401k = variables.spouseMonthlyEmployer401k;
      optimized.spouseRetirementContributions = {
        ...optimized.spouseRetirementContributions,
        employer: variables.spouseMonthlyEmployer401k
      };
    }
    if (variables.spouseAnnualTraditionalIRA !== undefined) optimized.spouseTraditionalIRAContribution = variables.spouseAnnualTraditionalIRA;
    if (variables.spouseAnnualRothIRA !== undefined) optimized.spouseRothIRAContribution = variables.spouseAnnualRothIRA;

    // Retirement monthly spending and part-time income
    if (variables.monthlyExpenses !== undefined) optimized.expectedMonthlyExpensesRetirement = variables.monthlyExpenses;
    if (variables.partTimeIncome !== undefined) optimized.partTimeIncomeRetirement = variables.partTimeIncome;
    if (variables.spousePartTimeIncome !== undefined) optimized.spousePartTimeIncomeRetirement = variables.spousePartTimeIncome;

    return optimized;
  }

  // Calculate net worth projections (OPTIMIZED) using the same algorithm as the dashboard
  
  // Calculate retirement withdrawal sequence (baseline)
  app.post("/api/calculate-withdrawal-sequence", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      
      // Get the user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      // Aggregate assets by tax type
      const assets = aggregateAssetsByType(profile);
      
      // Calculate age
      const currentAge = profile.dateOfBirth 
        ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() 
        : 30;
      const spouseAge = profile.spouseDateOfBirth 
        ? new Date().getFullYear() - new Date(profile.spouseDateOfBirth).getFullYear() 
        : currentAge;
      
      // Default investment returns by asset type
      const investmentReturns = {
        taxable: 0.06, // 6% for taxable accounts
        taxDeferred: 0.07, // 7% for 401k/IRA
        taxFree: 0.07, // 7% for Roth
        hsa: 0.06 // 6% for HSA
      };
      
      // Use glide path returns if specified
      if (profile.expectedRealReturn === -1) {
        // Glide path: more conservative as age increases
        const yearsToRetirement = Math.max(0, (profile.desiredRetirementAge || 65) - currentAge);
        const equityAllocation = Math.max(0.3, Math.min(0.8, 1 - (currentAge - 30) / 40));
        const avgReturn = equityAllocation * 0.08 + (1 - equityAllocation) * 0.035; // 8% equity, 3.5% bonds
        
        investmentReturns.taxable = avgReturn;
        investmentReturns.taxDeferred = avgReturn;
        investmentReturns.taxFree = avgReturn;
        investmentReturns.hsa = avgReturn;
      } else if (profile.expectedRealReturn > 0) {
        // Fixed return specified
        const fixedReturn = profile.expectedRealReturn;
        investmentReturns.taxable = fixedReturn;
        investmentReturns.taxDeferred = fixedReturn;
        investmentReturns.taxFree = fixedReturn;
        investmentReturns.hsa = fixedReturn;
      }
      
      const params = {
        currentAge,
        retirementAge: profile.desiredRetirementAge || 65,
        spouseCurrentAge: spouseAge,
        spouseRetirementAge: profile.spouseDesiredRetirementAge,
        lifeExpectancy: profile.userLifeExpectancy || 93,
        socialSecurityAge: profile.socialSecurityClaimAge || 67,
        spouseSocialSecurityAge: profile.spouseSocialSecurityClaimAge,
        socialSecurityBenefit: parseFloat(profile.socialSecurityBenefit) || 0,
        spouseSocialSecurityBenefit: parseFloat(profile.spouseSocialSecurityBenefit) || 0,
        pensionBenefit: parseFloat(profile.pensionBenefit) || 0,
        spousePensionBenefit: parseFloat(profile.spousePensionBenefit) || 0,
        partTimeIncomeRetirement: profile.partTimeIncomeRetirement || 0,
        spousePartTimeIncomeRetirement: profile.spousePartTimeIncomeRetirement || 0,
        annualIncome: profile.annualIncome || 0,
        spouseAnnualIncome: profile.spouseAnnualIncome || 0,
        monthlyExpenses: profile.expectedMonthlyExpensesRetirement || 8000,
        assets,
        investmentReturns,
        inflationRate: 0.025, // 2.5% inflation
        taxRate: 0.22 // 22% effective tax rate
      };
      
      const withdrawalSequence = calculateWithdrawalSequence(params);
      
      res.json({ projections: withdrawalSequence });
    } catch (error) {
      console.error('Error calculating withdrawal sequence:', error);
      next(error);
    }
  });
  
  // Calculate optimized retirement withdrawal sequence
  app.post("/api/calculate-optimized-withdrawal-sequence", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const variables = req.body;
      
      // Get the user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      // Create optimized profile with applied variables
      const optimizedProfile = { ...profile };
      
      // Apply optimization variables
      if (variables.retirementAge !== undefined) {
        optimizedProfile.desiredRetirementAge = variables.retirementAge;
      }
      if (variables.spouseRetirementAge !== undefined) {
        optimizedProfile.spouseDesiredRetirementAge = variables.spouseRetirementAge;
      }
      if (variables.socialSecurityAge !== undefined) {
        optimizedProfile.socialSecurityClaimAge = variables.socialSecurityAge;
        
        // Recalculate SS benefit
        const currentAge = profile.dateOfBirth 
          ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() 
          : 30;
        // Calculate AIME and PIA (AIME expects MONTHLY income)
        const monthlyIncome = (profile.annualIncome || 0) / 12;
        const userAIME = calculateAIME(monthlyIncome, currentAge, 67);
        const userPIA = calculatePrimaryInsuranceAmount(userAIME);
        const adjustedBenefit = calculateBenefitAtAge(variables.socialSecurityAge, 67, userPIA);
        optimizedProfile.socialSecurityBenefit = adjustedBenefit;
      }
      if (variables.spouseSocialSecurityAge !== undefined) {
        optimizedProfile.spouseSocialSecurityClaimAge = variables.spouseSocialSecurityAge;
        
        if ((profile.maritalStatus === 'married' || profile.maritalStatus === 'partnered') && 
            profile.spouseAnnualIncome) {
          const spouseAge = profile.spouseDateOfBirth 
            ? new Date().getFullYear() - new Date(profile.spouseDateOfBirth).getFullYear() 
            : 30;
          // Calculate AIME and PIA (AIME expects MONTHLY income)
          const spouseMonthlyIncome = (profile.spouseAnnualIncome || 0) / 12;
          const spouseAIME = calculateAIME(spouseMonthlyIncome, spouseAge, 67);
          const spousePIA = calculatePrimaryInsuranceAmount(spouseAIME);
          const adjustedSpouseBenefit = calculateBenefitAtAge(variables.spouseSocialSecurityAge, 67, spousePIA);
          optimizedProfile.spouseSocialSecurityBenefit = adjustedSpouseBenefit;
        }
      }
      if (variables.monthlyExpenses !== undefined) {
        optimizedProfile.expectedMonthlyExpensesRetirement = variables.monthlyExpenses;
      }
      if (variables.partTimeIncome !== undefined) {
        optimizedProfile.partTimeIncomeRetirement = variables.partTimeIncome;
      }
      if (variables.spousePartTimeIncome !== undefined) {
        optimizedProfile.spousePartTimeIncomeRetirement = variables.spousePartTimeIncome;
      }
      
      // Apply monthly contributions to increase assets over time
      if (variables.monthlyContributions !== undefined) {
        const yearsToRetirement = Math.max(0, (optimizedProfile.desiredRetirementAge || 65) - 
          (optimizedProfile.dateOfBirth ? new Date().getFullYear() - new Date(optimizedProfile.dateOfBirth).getFullYear() : 30));
        
        const totalAdditionalContributions = variables.monthlyContributions * 12 * yearsToRetirement;
        
        // Add to existing assets (distribute across account types)
        optimizedProfile.assets = optimizedProfile.assets || [];
        
        // Find or create accounts to add contributions to
        const find401k = optimizedProfile.assets.find((a: any) => a.type?.includes('401k'));
        const findRoth = optimizedProfile.assets.find((a: any) => a.type?.includes('Roth'));
        const findBrokerage = optimizedProfile.assets.find((a: any) => a.type?.includes('Brokerage'));
        
        if (find401k) {
          find401k.value = (find401k.value || 0) + totalAdditionalContributions * 0.5;
        }
        if (findRoth) {
          findRoth.value = (findRoth.value || 0) + totalAdditionalContributions * 0.3;
        }
        if (findBrokerage) {
          findBrokerage.value = (findBrokerage.value || 0) + totalAdditionalContributions * 0.2;
        }
      }
      
      // Aggregate assets by tax type
      const assets = aggregateAssetsByType(optimizedProfile);
      
      // Calculate age
      const currentAge = optimizedProfile.dateOfBirth 
        ? new Date().getFullYear() - new Date(optimizedProfile.dateOfBirth).getFullYear() 
        : 30;
      
      // Investment returns based on asset allocation
      const investmentReturns = {
        taxable: 0.06,
        taxDeferred: 0.07,
        taxFree: 0.07,
        hsa: 0.06
      };
      
      if (variables.assetAllocation === 'current-allocation') {
        // Use owner-specific allocations to calculate returns
        // This will be handled by the Monte Carlo engine with owner-specific logic
        const avgReturn = 0.06; // Default fallback for net worth projection
        investmentReturns.taxable = avgReturn;
        investmentReturns.taxDeferred = avgReturn;
        investmentReturns.taxFree = avgReturn;
        investmentReturns.hsa = avgReturn;
      } else if (variables.assetAllocation === 'glide-path') {
        const yearsToRetirement = Math.max(0, (optimizedProfile.desiredRetirementAge || 65) - currentAge);
        const equityAllocation = Math.max(0.3, Math.min(0.8, 1 - (currentAge - 30) / 40));
        const avgReturn = equityAllocation * 0.08 + (1 - equityAllocation) * 0.035; // 8% equity, 3.5% bonds
        
        investmentReturns.taxable = avgReturn;
        investmentReturns.taxDeferred = avgReturn;
        investmentReturns.taxFree = avgReturn;
        investmentReturns.hsa = avgReturn;
      } else if (variables.assetAllocation) {
        const fixedReturn = parseFloat(variables.assetAllocation) / 100;
        investmentReturns.taxable = fixedReturn;
        investmentReturns.taxDeferred = fixedReturn;
        investmentReturns.taxFree = fixedReturn;
        investmentReturns.hsa = fixedReturn;
      }
      
      // Calculate spouse age
      const spouseAge = optimizedProfile.spouseDateOfBirth 
        ? new Date().getFullYear() - new Date(optimizedProfile.spouseDateOfBirth).getFullYear() 
        : currentAge;
      
      const params = {
        currentAge,
        retirementAge: optimizedProfile.desiredRetirementAge || 65,
        spouseCurrentAge: spouseAge,
        spouseRetirementAge: optimizedProfile.spouseDesiredRetirementAge,
        lifeExpectancy: optimizedProfile.userLifeExpectancy || 93,
        socialSecurityAge: optimizedProfile.socialSecurityClaimAge || 67,
        spouseSocialSecurityAge: optimizedProfile.spouseSocialSecurityClaimAge,
        socialSecurityBenefit: parseFloat(optimizedProfile.socialSecurityBenefit) || 0,
        spouseSocialSecurityBenefit: parseFloat(optimizedProfile.spouseSocialSecurityBenefit) || 0,
        pensionBenefit: parseFloat(optimizedProfile.pensionBenefit) || 0,
        spousePensionBenefit: parseFloat(optimizedProfile.spousePensionBenefit) || 0,
        partTimeIncomeRetirement: optimizedProfile.partTimeIncomeRetirement || 0,
        spousePartTimeIncomeRetirement: optimizedProfile.spousePartTimeIncomeRetirement || 0,
        annualIncome: optimizedProfile.annualIncome || 0,
        spouseAnnualIncome: optimizedProfile.spouseAnnualIncome || 0,
        monthlyExpenses: optimizedProfile.expectedMonthlyExpensesRetirement || 8000,
        assets,
        investmentReturns,
        inflationRate: 0.025,
        taxRate: 0.22
      };
      
      const withdrawalSequence = calculateWithdrawalSequence(params);
      
      res.json({ projections: withdrawalSequence });
    } catch (error) {
      console.error('Error calculating optimized withdrawal sequence:', error);
      next(error);
    }
  });
  
  // Calculate Monte Carlo-based withdrawal sequence
  app.post("/api/calculate-monte-carlo-withdrawal-sequence", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      
      // Get the user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      console.log('Calculating Monte Carlo withdrawal sequence for user:', userId);
      
      // Generate Monte Carlo withdrawal sequence with optimization variables if provided
      const result = await generateMonteCarloWithdrawalSequence(profile, req.body);
      
      console.log('Monte Carlo withdrawal sequence calculated:', {
        projectionYears: result.projections.length,
        successProbability: result.monteCarloSummary.probabilityOfSuccess
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error calculating Monte Carlo withdrawal sequence:', error);
      next(error);
    }
  });

  // Monte Carlo simulation state route (merge-safe, prevents clobbering saved results)
  app.put("/api/monte-carlo-simulation", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const userId = req.user!.id;

      const existing = await storage.getFinancialProfile(userId);
      const incoming = req.body || {};
      const currentMC: any = (existing as any)?.monteCarloSimulation || {};

      // Deep merge with guard: keep existing retirementSimulation.results if incoming doesn't provide it
      const merged: any = {
        ...currentMC,
        ...incoming,
        retirementSimulation: {
          ...(currentMC?.retirementSimulation || {}),
          ...(incoming?.retirementSimulation || {}),
        },
      };
      if (!incoming?.retirementSimulation?.results && currentMC?.retirementSimulation?.results) {
        merged.retirementSimulation.results = currentMC.retirementSimulation.results;
      }

      const updatedProfile = await storage.updateFinancialProfile(userId, {
        monteCarloSimulation: merged,
      });
      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  });

  // Impact on Portfolio Balance cache endpoints
  // Computes a short fingerprint from profile lastUpdated + saved optimization variables
  const impactInputHash = (profile: any) => {
    const payload = {
      profileUpdatedAt: (profile as any)?.lastUpdated || null,
      optimizationVariables: (profile as any)?.optimizationVariables || null,
      v: 1,
    };
    const json = JSON.stringify(payload);
    return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
  };

  // GET cached data if valid for current inputs
  app.get("/api/retirement/impact-on-portfolio-balance-cache", async (req, res, next) => {
    try {
      console.log('[CACHE-API GET] Step 1: Impact on Portfolio Balance cache request received');
      
      if (!req.isAuthenticated()) {
        console.log('[CACHE-API GET] Step 1a: User not authenticated');
        return res.sendStatus(401);
      }
      
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;
      console.log('[CACHE-API GET] Step 2: User ID:', userId);
      
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        console.log('[CACHE-API GET] Step 2a: No profile found for user');
        return res.status(404).json({ cached: false });
      }
      
      console.log('[CACHE-API GET] Step 3: Profile loaded, checking retirementPlanningData:', {
        hasRetirementPlanningData: !!(profile as any)?.retirementPlanningData,
        hasImpactOnPortfolioBalance: !!(profile as any)?.retirementPlanningData?.impactOnPortfolioBalance,
        keys: Object.keys((profile as any)?.retirementPlanningData || {})
      });

      const currentHash = impactInputHash(profile);
      const impact = (profile as any)?.retirementPlanningData?.impactOnPortfolioBalance;
      
      console.log('[CACHE-API GET] Step 4: Cache validation:', {
        hasImpact: !!impact,
        hasInputHash: !!impact?.inputHash,
        hasProjectionData: !!impact?.projectionData,
        hasComparison: !!impact?.comparison,
        currentHash: currentHash,
        savedHash: impact?.inputHash,
        hashMatch: impact?.inputHash === currentHash,
        projectionDataLength: impact?.projectionData?.length,
        comparison: impact?.comparison
      });

      if (impact && impact.inputHash === currentHash && impact.projectionData && impact.comparison) {
        console.log('[CACHE-API GET] Step 5: Returning cached data');
        return res.json({
          cached: true,
          data: {
            projectionData: impact.projectionData,
            comparison: impact.comparison,
          },
          calculatedAt: impact.calculatedAt,
          inputHash: impact.inputHash,
        });
      }

      console.log('[CACHE-API GET] Step 5: No valid cache found, returning cached: false');
      return res.json({ cached: false });
    } catch (error) {
      console.error('[CACHE-API GET] Error reading impact cache:', error);
      next(error);
    }
  });

  // POST to save freshly generated impact data
  app.post("/api/retirement/impact-on-portfolio-balance-cache", async (req, res, next) => {
    try {
      console.log('[CACHE-API POST] Step 1: Save Impact on Portfolio Balance request received');
      
      if (!req.isAuthenticated()) {
        console.log('[CACHE-API POST] Step 1a: User not authenticated');
        return res.sendStatus(401);
      }
      
      const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;
      console.log('[CACHE-API POST] Step 2: User ID:', userId);
      
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        console.log('[CACHE-API POST] Step 2a: No profile found');
        return res.status(404).json({ error: "Financial profile not found" });
      }

      const { projectionData, comparison } = req.body || {};
      console.log('[CACHE-API POST] Step 3: Received data:', {
        hasProjectionData: !!projectionData,
        isArray: Array.isArray(projectionData),
        projectionLength: projectionData?.length,
        hasComparison: !!comparison,
        comparison: comparison
      });
      
      if (!projectionData || !Array.isArray(projectionData) || !comparison) {
        console.log('[CACHE-API POST] Step 3a: Invalid payload');
        return res.status(400).json({ error: "Invalid payload" });
      }

      const inputHash = impactInputHash(profile);
      const nowIso = new Date().toISOString();

      const existing = (profile as any).retirementPlanningData || {};
      console.log('[CACHE-API POST] Step 4: Existing retirementPlanningData keys:', Object.keys(existing));
      
      const updated = {
        ...existing,
        impactOnPortfolioBalance: {
          projectionData,
          comparison,
          inputHash,
          calculatedAt: nowIso,
          version: 1,
        },
      };
      
      console.log('[CACHE-API POST] Step 5: Saving to database with data:', {
        projectionDataLength: projectionData.length,
        comparison: comparison,
        inputHash: inputHash,
        calculatedAt: nowIso
      });

      await storage.updateFinancialProfile(userId, { retirementPlanningData: updated });
      console.log('[CACHE-API POST] Step 6: Successfully saved to database');
      
      return res.json({ saved: true, inputHash, calculatedAt: nowIso });
    } catch (error) {
      console.error('[CACHE-API POST] Error saving impact cache:', error);
      next(error);
    }
  });

  // Batch Stress Test endpoint - runs all scenarios individually for overview
  app.post("/api/batch-stress-tests", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const { useOptimizedVariables = true, cacheOnly = false } = req.body;
      
      // Get user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      console.log('Batch stress tests request for user:', userId);
      console.log('Use optimized variables?', useOptimizedVariables);
      console.log('Cache only?', cacheOnly);
      
      if (useOptimizedVariables && profile.optimizationVariables) {
        console.log('Optimization variables found:', {
          retirementAge: profile.optimizationVariables.retirementAge,
          socialSecurityAge: profile.optimizationVariables.socialSecurityAge,
          monthlyExpenses: profile.optimizationVariables.monthlyExpenses,
          hasOptimized: profile.optimizationVariables.hasOptimized,
          isLocked: profile.optimizationVariables.isLocked,
          optimizedScore: profile.optimizationVariables.optimizedScore?.probabilityOfSuccess
        });
      }
      
      // Check cache first
      const { widgetCacheManager } = await import('./widget-cache-manager');
      const cacheKey = `batch_stress_${useOptimizedVariables ? 'optimized' : 'baseline'}`;
      const cacheHash = widgetCacheManager.generateInputHash(cacheKey, {
        profileUpdatedAt: profile.lastUpdated,
        optimizationVariables: useOptimizedVariables ? profile.optimizationVariables : null,
        plan: useOptimizedVariables ? 'optimized' : 'baseline'
      });
      
      const cachedResult = await widgetCacheManager.getCachedWidget(userId, cacheKey, cacheHash);
      if (cachedResult && !req.body.forceRecalculate) {
        const cacheAge = Math.round((Date.now() - new Date(cachedResult.calculatedAt).getTime()) / 1000);
        console.log(`[BATCH-STRESS-CACHE] Returning cached batch stress test results (age: ${cacheAge}s)`);
        return res.json({
          ...cachedResult.data,
          isCached: true,
          cachedAt: cachedResult.calculatedAt,
          cacheAge
        });
      }
      
      // If cacheOnly is true and no cache exists, return empty response
      if (cacheOnly) {
        console.log('[BATCH-STRESS-CACHE] Cache only mode - no cache found, returning empty');
        return res.json({
          baseline: 0,
          scenarios: [],
          isCached: false,
          noCache: true
        });
      }
      
      // Import stress test types and engine
      const { DEFAULT_STRESS_SCENARIOS } = await import("../shared/stress-test-types");
      const { runStressTests } = await import("./stress-test-engine");
      
      const startTime = Date.now();
      
      // Prepare all stress test requests
      const baselineRequest = {
        scenarios: [], // No scenarios enabled
        optimizationVariables: useOptimizedVariables ? profile.optimizationVariables : undefined,
        runCombined: false
      };
      
      // Create requests for all scenarios
      const scenarioRequests = DEFAULT_STRESS_SCENARIOS.map(scenario => ({
        request: {
          scenarios: [{ ...scenario, enabled: true }],
          optimizationVariables: useOptimizedVariables ? profile.optimizationVariables : undefined,
          runCombined: false
        },
        scenario
      }));
      
      // Run baseline and all scenarios in PARALLEL
      console.log(`Running baseline + ${scenarioRequests.length} scenarios in parallel...`);
      
      const [baselineResponse, ...scenarioResponses] = await Promise.all([
        runStressTests(profile, baselineRequest),
        ...scenarioRequests.map(({ request }) => runStressTests(profile, request))
      ]);
      
      const baselineScore = baselineResponse.baseline.successProbability;
      console.log('Baseline score:', baselineScore);
      
      // Process results
      const individualResults = scenarioResponses.map((result, index) => {
        const scenario = scenarioRequests[index].scenario;
        return {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          baselineScore,
          stressedScore: result.individualResults[0]?.successProbability || baselineScore,
          impact: result.individualResults[0]?.impactPercentage || 0,
          description: scenario.description
        };
      });
      
      const elapsedTime = Date.now() - startTime;
      console.log(`Batch stress test complete in ${elapsedTime}ms. Results:`, individualResults.length);
      
      const responseData = {
        baseline: baselineScore,
        scenarios: individualResults,
        timestamp: Date.now(),
        calculationTime: elapsedTime,
        isCached: false,
        cacheAge: 0
      };
      
      // Cache the results
      await widgetCacheManager.cacheWidget(userId, cacheKey, cacheHash, responseData, 4); // Cache for 4 hours
      
      res.json(responseData);
    } catch (error) {
      console.error('Batch stress test error:', error);
      res.status(500).json({ 
        error: 'Failed to run batch stress tests',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Lightweight Stress Test Preview endpoint - for real-time UI updates
  app.post("/api/stress-test-preview", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      const { scenarios, useOptimizedVariables, baselineVariables } = req.body;
      
      // Get user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      // Quick validation
      if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
        return res.status(400).json({ error: "No scenarios provided" });
      }
      
      // Import stress test engine
      const { runStressTests } = await import("./stress-test-engine");
      
      // Run a lightweight stress test (fewer simulations for speed)
      const previewConfig = {
        scenarios,
        runCombined: true,
        saveToProfile: false,
        optimizationVariables: useOptimizedVariables && baselineVariables ? baselineVariables : undefined,
        simulationCount: 100 // Reduced for faster response
      };
      
      const results = await runStressTests(profile, previewConfig);
      
      // Return only the combined result for the preview
      res.json({
        successProbability: results.combinedResult?.successProbability || 0,
        impactPercentage: results.combinedResult?.impactPercentage || 0
      });
      
    } catch (error) {
      console.error('Stress test preview error:', error);
      res.status(500).json({ 
        error: 'Failed to calculate stress preview'
      });
    }
  });

  // Stress Test Scenarios for Retirement Planning
  app.post("/api/stress-test-scenarios", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      
      // Get the user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      console.log('Running stress test scenarios for user:', userId);
      const incomingScenarios = Array.isArray(req.body.scenarios)
        ? req.body.scenarios.filter((s: any) => s && typeof s === 'object')
        : [];
      console.log('Request body scenarios:', JSON.stringify(
        incomingScenarios.map((s: any) => ({ id: s?.id, enabled: !!s?.enabled })), null, 2));
      
      // Support both new and old field names for backwards compatibility
      const optimizationVariables = req.body.optimizationVariables || req.body.baselineVariables;
      const plan = optimizationVariables ? 'optimized' : 'baseline';
      
      // Check for cached stress test results using new widget cache system
      const { widgetCacheManager } = await import('./widget-cache-manager');
      
      // Generate cache dependencies for stress test
      const stressTestDependencies = {
        profileUpdatedAt: profile.lastUpdated,
        optimizationVariables: optimizationVariables || profile.optimizationVariables,
        scenarios: incomingScenarios
          .filter((s: any) => s?.enabled && s?.id != null)
          .map((s: any) => ({ id: s.id, enabled: s.enabled, magnitude: s.magnitude }))
          .sort((a, b) => a.id.localeCompare(b.id)), // Sort for consistent hashing
        runCombined: req.body.runCombined || false,
        plan: plan // Add plan discriminator for caching
      };
      
      const inputHash = widgetCacheManager.generateInputHash('stress_test_scenarios', stressTestDependencies);
      const cachedWidget = await widgetCacheManager.getCachedWidget(userId, 'stress_test_scenarios', inputHash);
      
      if (cachedWidget && !req.body.forceRecalculate) {
        console.log('[STRESS-TEST-CACHE] Using cached stress test results from widget cache');
        res.json({
          ...cachedWidget.data,
          isCached: true,
          cachedAt: cachedWidget.calculatedAt,
          inputHash: cachedWidget.inputHash,
          cacheAge: Math.round((Date.now() - new Date(cachedWidget.calculatedAt).getTime()) / 1000)
        });
        return; // Exit early with cached data
      } else {
        console.log('[STRESS-TEST-CACHE] No cached data found or forced recalculation, running fresh stress tests');
      }
      
      // Import stress test engine
      const { runStressTests } = await import("./stress-test-engine");
      
      // Run stress tests with the provided scenarios
      const stressTestResults = await runStressTests(profile, {
        ...req.body,
        scenarios: incomingScenarios
      });
      
      console.log('Stress test results:', {
        baseline: stressTestResults.baseline.successProbability,
        scenariosRun: stressTestResults.individualResults.length,
        hasCombined: !!stressTestResults.combinedResult
      });
      
      // Always save results to profile for caching (not just when saveResults is true)
      try {
        await storage.updateFinancialProfile(userId, {
          lastStressTestResults: stressTestResults,
          lastStressTestDate: new Date().toISOString()
        });
        
        // Cache the results in widget cache system for fast retrieval
        await widgetCacheManager.cacheWidget(
          userId,
          'stress_test_scenarios',
          inputHash,
          {
            ...stressTestResults,
            calculatedAt: new Date().toISOString()
          },
          4 // Cache for 4 hours - balance between freshness and performance
        );
        
        console.log('[STRESS-TEST-CACHE] Stress test results cached successfully');
      } catch (saveError) {
        console.error('Failed to save stress test results for caching:', saveError);
        // Don't fail the request if caching fails
      }
      
      res.json({
        ...stressTestResults,
        isCached: false,
        calculatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error running stress tests:', error);
      next(error);
    }
  });

  // Cash Flow Map route
  app.get("/api/v2/rpc/cashflow-map", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { planId, scenarioId, percentile } = req.query;
      const userId = req.user!.id;
      
      // Get the user's financial profile
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }

      // Generate cash flow data based on scenario and percentile
      const cashFlowData = generateCashFlowData(profile, {
        scenarioId: scenarioId as string || 'base',
        percentile: parseInt(percentile as string) || 50
      });
      
      res.json(cashFlowData);
    } catch (error) {
      next(error);
    }
  });

  // Chat routes
  app.get("/api/chat-messages", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const messages = await storage.getChatMessages(req.user!.id);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/chat-messages", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      // Generate AI response using enhanced Gemini API with comprehensive context
      const aiResponse = await generateEnhancedAIResponse(
        req.body.message,
        req.user!.id,
      );

      const message = await storage.createChatMessage(req.user!.id, {
        message: req.body.message,
        response: aiResponse,
      });

      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  // Chat document upload endpoint
  const chatUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit for multiple file types
    },
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed. Supported types: PDF, images, Excel, CSV, Word documents`));
      }
    },
  });

  app.post("/api/chat-messages/upload", chatUpload.array('documents', 5), async (req, res, next) => {
    try {
      console.log('File upload endpoint hit');
      if (!req.isAuthenticated()) return res.sendStatus(401);
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const userId = req.user!.id;
      const { message } = req.body;
      const files = req.files as Express.Multer.File[];
      
      console.log(`Processing ${files.length} files for user ${userId}`);
      console.log('Files:', files.map(f => ({ name: f.originalname, size: f.size, type: f.mimetype })));
      
      // Create initial chat message
      const chatMessage = await storage.createChatMessage(userId, {
        message: message || `Uploaded ${files.length} document(s)`,
        response: null, // Will be updated after processing
      });
      
      console.log('Created chat message:', chatMessage.id);

      // Process each uploaded file
      const processedDocuments = [];
      for (const file of files) {
        const processedDoc = await processUploadedDocument(file, userId, chatMessage.id);
        processedDocuments.push(processedDoc);
      }

      // Generate AI response with document context
      const documentContext = processedDocuments.map(doc => ({
        fileName: doc.originalName,
        type: doc.documentType,
        summary: doc.aiSummary,
        extractedText: doc.extractedText?.substring(0, 500) // First 500 chars
      }));

      const aiResponse = await generateEnhancedAIResponseWithDocuments(
        message || `Analyze the uploaded document(s): ${files.map(f => f.originalname).join(', ')}`,
        userId,
        documentContext
      );

      // Update chat message with AI response
      const updatedMessage = await storage.updateChatMessage(chatMessage.id, {
        response: aiResponse,
      });

      res.json({
        message: updatedMessage,
        documents: processedDocuments.map(doc => ({
          id: doc.id,
          fileName: doc.originalName,
          documentType: doc.documentType,
          processingStatus: doc.processingStatus,
          aiSummary: doc.aiSummary
        }))
      });

    } catch (error) {
      console.error('Error uploading chat documents:', error);
      next(error);
    }
  });

  // Get documents for a specific chat message
  app.get("/api/chat-messages/:messageId/documents", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const messageId = parseInt(req.params.messageId);
      const documents = await storage.getChatDocuments(messageId);
      
      res.json(documents);
    } catch (error) {
      next(error);
    }
  });

  // Download a specific chat document
  app.get("/api/chat-documents/:documentId/download", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const documentId = parseInt(req.params.documentId);
      const document = await storage.getChatDocument(documentId, req.user!.id);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if file exists
      try {
        await fs.access(document.filePath);
        res.download(document.filePath, document.originalName);
      } catch (error) {
        res.status(404).json({ error: 'File not found on disk' });
      }
    } catch (error) {
      next(error);
    }
  });

  // Generate AI-powered cash flow improvement suggestions
  app.post("/api/generate-cash-flow-suggestions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { cashFlowData, profile } = req.body;
      const userId = req.user!.id;
      
      // Check cache first
      const { widgetCacheManager } = await import('./widget-cache-manager');
      const cacheKey = widgetCacheManager.generateInputHash('cash_flow_suggestions', { cashFlowData });
      const cachedSuggestions = await widgetCacheManager.getCachedWidget(userId, 'cash_flow_suggestions', cacheKey);
      
      if (cachedSuggestions) {
        console.log('[CACHE] Returning cached cash flow suggestions');
        return res.json(cachedSuggestions.data);
      }
      
      // Generate suggestions using Gemini
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
      
      if (!apiKey) {
        // Return default suggestions if no API key
        return res.json({
          suggestions: [
            {
              icon: 'PiggyBank',
              title: 'Reduce Discretionary Spending',
              description: 'Track and cut non-essential expenses by 10-15% to boost savings',
              impact: 'high'
            },
            {
              icon: 'Home',
              title: 'Optimize Housing Costs',
              description: 'Consider refinancing mortgage or negotiating rent to save $200-500/month',
              impact: 'high'
            },
            {
              icon: 'TrendingUp',
              title: 'Increase Income',
              description: 'Pursue side hustles or negotiate a raise to add $500+/month',
              impact: 'high'
            }
          ]
        });
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `As a financial advisor, provide 3 specific, actionable suggestions to improve cash flow based on:
      
      Monthly Income: $${cashFlowData.totalMonthlyIncome}
      Monthly Expenses: $${cashFlowData.totalMonthlyExpenses}
      Current Cash Flow: $${cashFlowData.monthlyCashFlow}
      Savings Rate: ${cashFlowData.savingsRate}%
      
      Expense Breakdown:
      - Housing: $${cashFlowData.housingExpenses} (${((cashFlowData.housingExpenses/cashFlowData.totalMonthlyIncome)*100).toFixed(0)}% of income)
      - Transportation: $${cashFlowData.transportationExpenses}
      - Food: $${cashFlowData.foodExpenses}
      - Other: $${cashFlowData.otherExpenses}
      
      Return as JSON array with exactly 3 suggestions, each with:
      - title: Short action title (e.g., "Reduce Housing Costs")
      - description: Specific actionable advice with numbers/percentages
      - impact: "high", "medium", or "low"
      - icon: One of: "PiggyBank", "Home", "Calculator", "Receipt", "TrendingUp"
      - potentialSavings: Estimated annual savings in dollars
      
      Focus on: expense reduction if high expenses, income increase if low income, specific category cuts if any exceed recommended percentages.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON from response
      let suggestions = [];
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('Error parsing AI suggestions:', parseError);
      }
      
      // Cache the suggestions
      const cashFlowResult = { suggestions };
      await widgetCacheManager.cacheWidget(userId, 'cash_flow_suggestions', cacheKey, cashFlowResult, 24); // Cache for 24 hours
      
      res.json(cashFlowResult);
    } catch (error) {
      console.error('Error generating cash flow suggestions:', error);
      res.json({
        suggestions: [
          {
            icon: 'PiggyBank',
            title: 'Build Emergency Fund',
            description: 'Save 10% of income automatically before expenses',
            impact: 'high'
          },
          {
            icon: 'Calculator',
            title: 'Reduce Fixed Costs',
            description: 'Review and negotiate recurring bills and subscriptions',
            impact: 'medium'
          },
          {
            icon: 'TrendingUp',
            title: 'Boost Income',
            description: 'Explore freelancing or skill development for higher pay',
            impact: 'high'
          }
        ]
      });
    }
  });

  // Generate AI-powered net worth improvement suggestions
  app.post("/api/generate-net-worth-suggestions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { netWorthData, profile } = req.body;
      const userId = req.user!.id;
      
      // Check cache first
      const { widgetCacheManager } = await import('./widget-cache-manager');
      const cacheKey = widgetCacheManager.generateInputHash('net_worth_suggestions', { netWorthData });
      const cachedSuggestions = await widgetCacheManager.getCachedWidget(userId, 'net_worth_suggestions', cacheKey);
      
      if (cachedSuggestions) {
        console.log('[CACHE] Returning cached net worth suggestions');
        return res.json(cachedSuggestions.data);
      }
      
      // Generate suggestions using Gemini
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
      
      if (!apiKey) {
        // Return default suggestions if no API key
        return res.json({
          suggestions: [
            {
              icon: 'PiggyBank',
              title: 'Build Emergency Fund',
              description: 'Establish 3-6 months of expenses in a high-yield savings account earning 4-5% APY',
              impact: 'high'
            },
            {
              icon: 'CreditCard',
              title: 'Pay Off High-Interest Debt',
              description: 'Focus on eliminating credit card debt to save on interest charges',
              impact: 'high'
            },
            {
              icon: 'TrendingUpIcon',
              title: 'Maximize Retirement Contributions',
              description: 'Increase 401(k) contributions to capture full employer match',
              impact: 'high'
            }
          ]
        });
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `As a financial advisor, provide 3 specific, actionable suggestions to improve net worth based on:
      
      Current Net Worth: $${netWorthData.netWorth}
      Assets: $${netWorthData.totalAssets}
      Real Estate Equity: $${netWorthData.totalRealEstateEquity}
      Liabilities: $${netWorthData.totalLiabilities}
      
      Breakdown:
      - Bank Accounts: $${netWorthData.bankAccounts}
      - Investments: $${netWorthData.investments}
      - Retirement: $${netWorthData.retirementAccounts}
      - Credit Cards: $${netWorthData.creditCards}
      - Loans: $${netWorthData.loans}
      
      Return as JSON array with exactly 3 suggestions, each with:
      - title: Short action title (e.g., "Refinance High-Interest Debt")
      - description: Specific actionable advice with numbers/percentages
      - impact: "high", "medium", or "low"
      - icon: One of: "PiggyBank", "CreditCard", "TrendingUpIcon", "Home", "Wallet"
      
      Focus on: debt reduction if high debt, investment optimization if low retirement, real estate if applicable.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON from response
      let suggestions = [];
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('Error parsing AI suggestions:', parseError);
      }
      
      // Cache the suggestions
      const netWorthResult = { suggestions };
      await widgetCacheManager.cacheWidget(userId, 'net_worth_suggestions', cacheKey, netWorthResult, 24); // Cache for 24 hours
      
      res.json(netWorthResult);
    } catch (error) {
      console.error('Error generating net worth suggestions:', error);
      res.json({
        suggestions: [
          {
            icon: 'PiggyBank',
            title: 'Build Emergency Fund',
            description: 'Establish 3-6 months of expenses in a high-yield savings account',
            impact: 'high'
          },
          {
            icon: 'CreditCard',
            title: 'Reduce High-Interest Debt',
            description: 'Focus on paying off credit cards and high-interest loans',
            impact: 'high'
          },
          {
            icon: 'TrendingUpIcon',
            title: 'Increase Investment Contributions',
            description: 'Maximize tax-advantaged retirement account contributions',
            impact: 'medium'
          }
        ]
      });
    }
  });

  // Generate AI-powered financial health improvement suggestions
  app.post("/api/generate-financial-health-suggestions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { healthScoreData, profile } = req.body;
      const userId = req.user!.id;
      
      // Check cache first
      const { widgetCacheManager } = await import('./widget-cache-manager');
      const cacheKey = widgetCacheManager.generateInputHash('financial_health_suggestions', { healthScoreData });
      const cachedSuggestions = await widgetCacheManager.getCachedWidget(userId, 'financial_health_suggestions', cacheKey);
      
      if (cachedSuggestions) {
        console.log('[CACHE] Returning cached financial health suggestions');
        return res.json(cachedSuggestions.data);
      }
      
      // Generate suggestions using Gemini
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
      
      if (!apiKey) {
        // Return default suggestions if no API key
        return res.json({
          suggestions: [
            {
              icon: 'Target',
              title: 'Improve Net Worth Ratio',
              description: 'Focus on increasing assets or reducing liabilities to reach 5x annual income',
              impact: 'high',
              priority: 1
            },
            {
              icon: 'Shield',
              title: 'Enhance Emergency Fund',
              description: 'Build emergency fund to cover 6 months of essential expenses',
              impact: 'high',
              priority: 2
            },
            {
              icon: 'TrendingDown',
              title: 'Reduce Debt-to-Income',
              description: 'Pay down high-interest debt to improve DTI ratio below 28%',
              impact: 'medium',
              priority: 3
            }
          ]
        });
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `As a financial advisor, analyze this financial health score breakdown and provide exactly 3 personalized, actionable recommendations to improve the overall financial health score.
      
      Financial Health Score: ${healthScoreData.overall}/100
      
      Component Scores:
      - Net Worth vs Income: ${healthScoreData.netWorthScore}/100 (25% weight) - Target: Net worth should be 5x annual income
      - Emergency Fund: ${healthScoreData.emergencyFundScore}/100 (20% weight) - Target: 3-6 months of expenses
      - Debt-to-Income: ${healthScoreData.dtiScore}/100 (20% weight) - Target: DTI below 28% is ideal
      - Savings Rate: ${healthScoreData.savingsRateScore}/100 (20% weight) - Target: Save 20%+ of income
      - Insurance Coverage: ${healthScoreData.insuranceScore}/100 (15% weight) - Target: Comprehensive coverage
      
      Additional Context:
      ${healthScoreData.emergencyMonths ? `Emergency Fund Coverage: ${healthScoreData.emergencyMonths} months` : ''}
      ${healthScoreData.dtiRatio ? `Current DTI Ratio: ${healthScoreData.dtiRatio}%` : ''}
      ${healthScoreData.savingsRate ? `Current Savings Rate: ${healthScoreData.savingsRate}%` : ''}
      
      IMPORTANT: Focus on the LOWEST scoring components first, as improving these will have the biggest impact on the overall score.
      
      Return as JSON array with exactly 3 suggestions, ranked by priority (most impactful first):
      - title: Short, specific action title (max 5 words)
      - description: Specific actionable advice with exact numbers, percentages, or timeframes
      - impact: "high" for scores below 50, "medium" for scores 50-80, "low" for scores above 80
      - icon: Choose the most relevant: "Target" (net worth), "Shield" (emergency fund), "TrendingDown" (debt), "PiggyBank" (savings), "Umbrella" (insurance), "TrendingUp" (investments)
      - priority: 1 (most important), 2, or 3 (least important) based on which component needs the most improvement
      
      Make suggestions ultra-specific and actionable, not generic advice.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON from response
      let suggestions = [];
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
          // Sort by priority
          suggestions.sort((a: any, b: any) => (a.priority || 1) - (b.priority || 1));
        }
      } catch (parseError) {
        console.error('Error parsing AI suggestions:', parseError);
      }
      
      // Cache the suggestions
      const healthResult = { suggestions };
      await widgetCacheManager.cacheWidget(userId, 'financial_health_suggestions', cacheKey, healthResult, 24); // Cache for 24 hours
      
      res.json(healthResult);
    } catch (error) {
      console.error('Error generating financial health suggestions:', error);
      res.json({
        suggestions: [
          {
            icon: 'Target',
            title: 'Improve Net Worth Ratio',
            description: 'Focus on increasing assets or reducing liabilities to reach 5x annual income',
            impact: 'high',
            priority: 1
          },
          {
            icon: 'Shield',
            title: 'Enhance Emergency Fund',
            description: 'Build emergency fund to cover 6 months of essential expenses',
            impact: 'high',
            priority: 2
          },
          {
            icon: 'TrendingDown',
            title: 'Reduce Debt-to-Income',
            description: 'Pay down high-interest debt to improve DTI ratio below 28%',
            impact: 'medium',
            priority: 3
          }
        ]
      });
    }
  });

  // Comprehensive user data for AI assistant
  app.get("/api/user-context", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      // Set headers to prevent caching for real-time data
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      
      const comprehensiveData = await buildComprehensiveUserContext(req.user!.id);
      res.json(comprehensiveData);
    } catch (error) {
      next(error);
    }
  });

  // Back-compat alias: centralized chat context
  app.get("/api/chat-context", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      const comprehensiveData = await buildComprehensiveUserContext(req.user!.id);
      res.json(comprehensiveData);
    } catch (error) {
      next(error);
    }
  });

  // PDF report generation
  app.post("/api/generate-report", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      // Here we would generate a PDF report
      // For now, we'll return a success message
      res.json({ message: "PDF report generation requested" });
    } catch (error) {
      next(error);
    }
  });

  // Reset financial data route - Comprehensive deletion
  app.delete("/api/reset-financial-data", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const userId = req.user!.id;
      
      console.log(`🚨 Comprehensive reset requested for user ${userId}`);

      // Delete ALL user data comprehensively
      await storage.deleteAllUserData(userId);
      
      // Clear server-side caches for this user
      try {
        const { widgetCacheManager } = await import('./widget-cache-manager');
        await widgetCacheManager.invalidateAllUserCache(userId);
        console.log('✅ Cleared server widget cache');
      } catch (cacheError) {
        console.error('⚠️ Failed to clear widget cache:', cacheError);
        // Don't fail the reset if cache clearing fails
      }

      console.log(`🎉 Comprehensive reset completed successfully for user ${userId}`);
      
      res.json({ 
        message: "All financial data reset successfully",
        deletedSections: [
          "Financial profile and calculations",
          "Assets and liabilities", 
          "Goals and life planning",
          "Estate planning documents and beneficiaries",
          "Education funding plans",
          "Debt management plans and scenarios",
          "Plaid bank connections and transactions",
          "Investment recommendations and cache",
          "AI chat history and insights",
          "Reports and snapshots", 
          "Achievement and progress tracking",
          "Widget and calculation cache"
        ]
      });
    } catch (error) {
      console.error('❌ Error during comprehensive financial data reset:', error);
      res.status(500).json({ 
        error: "Failed to reset financial data",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Hard reset endpoint for development - clears ALL caches and data
  app.post("/api/admin/hard-reset", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const userId = req.user!.id;

      // 1. Delete all user data from database
      await storage.deleteFinancialProfile(userId);
      await storage.deleteChatMessages(userId);
      
      // 2. Clear any server-side caches (if you have Redis, clear it here)
      // Example: await redis.flushdb();
      
      // 3. Clear any in-memory caches
      // If you have any global caches, clear them here
      
      // 4. Log the hard reset for debugging
      console.log(`[HARD RESET] User ${userId} performed hard reset at ${new Date().toISOString()}`);
      
      res.json({ 
        success: true, 
        message: "All server-side data and caches cleared",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[HARD RESET ERROR]:', error);
      res.status(500).json({ 
        success: false,
        error: "Failed to perform hard reset" 
      });
    }
  });

  // Data deletion route
  app.delete("/api/delete-data", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      // Here we would delete all user data
      // For now, we'll return a success message
      res.json({ message: "Data deletion requested" });
    } catch (error) {
      next(error);
    }
  });

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed'));
      }
    },
  });

  // Tax return analysis endpoints
  app.post("/api/analyze-tax-return", upload.single("taxReturn"), async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const userId = req.user!.id;
      const { incomeChange, incomeChangeDetails, deductionChange, deductionChangeDetails, comprehensiveAnalysis } = req.body;

      let analysisResult;

      if (req.file) {
        // Scenario 2: Tax return uploaded - analyze with file + financial data
        const rawAnalysisResult = await analyzeTaxReturnWithGemini(
          req.file.buffer,
          {
            incomeChange,
            incomeChangeDetails,
            deductionChange,
            deductionChangeDetails,
          },
          userId
        );
        
        // Extract both strategies and accurate tax data from the analysis
        analysisResult = {
          strategies: rawAnalysisResult.strategies || [],
          currentTaxLiability: rawAnalysisResult.currentTaxLiability || 0,
          projectedTaxLiability: rawAnalysisResult.projectedTaxLiability || 0,
          totalPotentialSavings: rawAnalysisResult.totalPotentialSavings || 0,
          effectiveTaxRate: rawAnalysisResult.effectiveTaxRate || 0,
          marginalTaxRate: rawAnalysisResult.marginalTaxRate || 0,
          // Store extracted tax data for accuracy (no personal names)
          extractedTaxData: {
            adjustedGrossIncome: rawAnalysisResult.adjustedGrossIncome || 0,
            totalDeductions: rawAnalysisResult.totalDeductions || 0,
            taxableIncome: rawAnalysisResult.taxableIncome || 0,
            filingStatus: rawAnalysisResult.filingStatus || null,
            dependentCount: rawAnalysisResult.dependentCount || 0,
            federalTaxesPaid: rawAnalysisResult.federalTaxesPaid || 0,
            stateTaxesPaid: rawAnalysisResult.stateTaxesPaid || 0,
            w2Income: rawAnalysisResult.w2Income || 0,
            selfEmploymentIncome: rawAnalysisResult.selfEmploymentIncome || 0,
            investmentIncome: rawAnalysisResult.investmentIncome || 0,
            extractionDate: new Date().toISOString()
          }
        };
      } else if (comprehensiveAnalysis === "true") {
        // Scenario 1: No tax return - analyze only financial data
        analysisResult = await generateComprehensiveFinancialAnalysis(
          {
            incomeChange,
            incomeChangeDetails,
            deductionChange,
            deductionChangeDetails,
          },
          userId
        );
      } else {
        return res.status(400).json({ error: "No file uploaded and comprehensive analysis not requested" });
      }

      // Clear any existing tax analysis before storing new results
      // This ensures no stale data from previous analyses persists
      await storage.updateFinancialProfile(userId, {
        taxReturns: null,
      });
      
      // Store the new analysis result in the financial profile
      await storage.updateFinancialProfile(userId, {
        taxReturns: analysisResult,
      });

      res.json({ message: "Analysis completed successfully" });
    } catch (error) {
      console.error("Error analyzing financial data:", error);
      res.status(500).json({ error: "Failed to analyze financial data" });
    }
  });

  app.get("/api/tax-analysis-result", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const userId = req.user!.id;
      const profile = await storage.getFinancialProfile(userId);
      
      if (!profile || !profile.taxReturns) {
        return res.status(404).json({ error: "No tax analysis found" });
      }

      // If we have extracted tax data from PDF, use it for accuracy
      // Otherwise fall back to profile data
      if (profile.taxReturns.extractedTaxData && profile.taxReturns.extractedTaxData.adjustedGrossIncome > 0) {
        // Use accurate data from tax return
        res.json({
          strategies: profile.taxReturns.strategies || [],
          currentTaxLiability: profile.taxReturns.currentTaxLiability || 0,
          projectedTaxLiability: profile.taxReturns.projectedTaxLiability || 0,
          totalPotentialSavings: profile.taxReturns.totalPotentialSavings || 0,
          effectiveTaxRate: profile.taxReturns.effectiveTaxRate || 0,
          marginalTaxRate: profile.taxReturns.marginalTaxRate || 0,
          extractedTaxData: profile.taxReturns.extractedTaxData
        });
      } else {
        // Fall back to calculating from profile
        const taxOverview = calculateTaxOverview(profile);
        
        res.json({
          strategies: profile.taxReturns.strategies || [],
          currentTaxLiability: taxOverview.projectedTotalTax,
          projectedTaxLiability: profile.taxReturns.projectedTaxLiability || 0,
          totalPotentialSavings: profile.taxReturns.totalPotentialSavings || 0,
          effectiveTaxRate: taxOverview.effectiveTaxRate,
          marginalTaxRate: taxOverview.marginalTaxRate
        });
      }
    } catch (error) {
      console.error("Error fetching tax analysis:", error);
      res.status(500).json({ error: "Failed to fetch tax analysis" });
    }
  });

  // Generate hyperpersonalized tax recommendations using intake form and retirement data
  app.post("/api/generate-tax-recommendations", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const userId = req.user!.id;
      
      // Get user's complete financial profile and retirement data
      const profile = await storage.getFinancialProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }

      // Generate hyperpersonalized tax recommendations
      const recommendations = await generateHyperpersonalizedTaxRecommendations(userId, profile);
      
      // Store recommendations in database for persistence
      await storage.updateFinancialProfile(userId, {
        taxRecommendations: recommendations,
      });

      res.json(recommendations);
    } catch (error) {
      console.error("Error generating tax recommendations:", error);
      res.status(500).json({ error: "Failed to generate tax recommendations" });
    }
  });

  // Get saved tax recommendations
  app.get("/api/tax-recommendations", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const profile = await storage.getFinancialProfile(req.user!.id);
      
      if (!profile || !profile.taxRecommendations) {
        return res.status(404).json({ error: "No tax recommendations found" });
      }

      res.json(profile.taxRecommendations);
    } catch (error) {
      console.error("Error fetching tax recommendations:", error);
      res.status(500).json({ error: "Failed to fetch tax recommendations" });
    }
  });

  // Generate retirement insights using Gemini and persist
  app.post("/api/generate-retirement-insights", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const userId = req.user!.id;
      const profile = await storage.getFinancialProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }

      const insights = await generateRetirementInsights(userId, profile);

      await storage.updateFinancialProfile(userId, {
        retirementInsights: insights,
      });

      res.json(insights);
    } catch (error) {
      console.error("Error generating retirement insights:", error);
      res.status(500).json({ error: "Failed to generate retirement insights" });
    }
  });

  // Get saved retirement insights
  app.get("/api/retirement-insights", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const userId = req.user!.id;
      const profile = await storage.getFinancialProfile(userId);
      // If not present, opportunistically generate once and return
      if (!profile || !profile.retirementInsights) {
        try {
          if (!profile) return res.json({ insights: [], lastUpdated: null });
          const insights = await generateRetirementInsights(userId, profile);
          await storage.updateFinancialProfile(userId, { retirementInsights: insights });
          return res.json(insights);
        } catch (genErr) {
          console.warn('Unable to auto-generate retirement insights:', genErr);
          return res.json({ insights: [], lastUpdated: null });
        }
      }

      res.json(profile.retirementInsights);
    } catch (error) {
      console.error("Error fetching retirement insights:", error);
      res.status(500).json({ error: "Failed to fetch retirement insights" });
    }
  });

  // Generate centralized insights using comprehensive AI context and persist
  app.post("/api/generate-central-insights", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const userId = req.user!.id;
      const insights = await generateCentralInsights(userId);
      await storage.updateFinancialProfile(userId, { centralInsights: insights });
      // Also store a dashboardInsights row with hash if we can compute it
      try {
        const estateDocuments = await storage.getEstateDocuments(userId);
        const profile = await storage.getFinancialProfile(userId);
        const { createProfileDataHash } = await import('./gemini-insights');
        const profileDataHash = createProfileDataHash(profile || {}, estateDocuments);
        await storage.createDashboardInsights(userId, {
          insights: insights,
          profileDataHash,
          generationVersion: '1.0',
          generatedByModel: 'gemini-2.5-flash-lite',
          financialSnapshot: (profile as any)?.calculations || null,
        });
      } catch (e) {
        console.warn('Unable to store dashboardInsights for central insights:', e);
      }
      res.json(insights);
    } catch (error) {
      console.error("Error generating central insights:", error);
      res.status(500).json({ error: "Failed to generate central insights" });
    }
  });

  // Get centralized insights (auto-generate or refresh if profile changed)
  app.get("/api/central-insights", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const userId = req.user!.id;
      const profile = await storage.getFinancialProfile(userId);

      // Decide if we should regenerate using dashboardInsights profile hash
      try {
        const estateDocuments = await storage.getEstateDocuments(userId);
        const { createProfileDataHash } = await import('./gemini-insights');
        const currentProfileHash = createProfileDataHash(profile || {}, estateDocuments);
        const should = await storage.shouldRegenerateInsights(userId, currentProfileHash);
        if (should) {
          const insights = await generateCentralInsights(userId);
          await storage.updateFinancialProfile(userId, { centralInsights: insights });
          await storage.createDashboardInsights(userId, {
            insights,
            profileDataHash: currentProfileHash,
            generationVersion: '1.0',
            generatedByModel: 'gemini-2.5-flash-lite',
            financialSnapshot: (profile as any)?.calculations || null,
          });
          return res.json(insights);
        }
      } catch (hashErr) {
        console.warn('central-insights: hash check failed; falling back to cached or fresh gen:', hashErr);
      }

      if (profile?.centralInsights?.insights && profile.centralInsights.insights.length >= 1) {
        return res.json(profile.centralInsights);
      }
      const insights = await generateCentralInsights(userId);
      await storage.updateFinancialProfile(userId, { centralInsights: insights });
      return res.json(insights);
    } catch (error) {
      console.error("Error fetching central insights:", error);
      res.status(500).json({ error: "Failed to fetch central insights" });
    }
  });

  async function generateCentralInsights(userId: number): Promise<any> {
    const { buildComprehensiveUserContext } = await import('./ai-context-builder');
    const { formatUserDataForAI } = await import('./ai-context-builder');
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key not configured");

    // Build comprehensive context used by AI Assistant
    const userData = await buildComprehensiveUserContext(userId);
    const contextPrompt = formatUserDataForAI(userData);

    // Extract magnitudes for fallback estimates
    const profile = userData.profile || {};
    const calculations = userData.calculations || {};
    const assets: any[] = Array.isArray(profile.assets) ? profile.assets : [];
    const totalAssets = Number(calculations.totalAssets || 0);
    const totalLiabilities = Number(calculations.totalLiabilities || 0);
    const netWorth = Number(calculations.netWorth || (totalAssets - totalLiabilities));
    const monthlyExpenses = profile.monthlyExpenses
      ? Object.values(profile.monthlyExpenses).reduce((s: number, v: any) => s + (Number(v) || 0), 0)
      : 0;
    const annualBudget = monthlyExpenses * 12;
    const taxableBrokerageTotal = assets
      .filter(a => typeof a.type === 'string' && /brokerage|investment|taxable|etf|stock|fund/i.test(a.type))
      .reduce((s, a) => s + (Number(a.value) || 0), 0);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `${contextPrompt}

=== GLOBAL INSIGHTS REQUEST ===
You are a CFP professional generating a unified list of personalized recommendations across retirement, tax, debt, estate, education, insurance, and cash-flow.

Requirements:
- Return 10–12 insights ranked by priority (1 = highest urgency/impact).
- Each insight must include: id, priority (1–3), title, explanation, estimatedImpact (positive $ savings/benefit), and category.
- Show conservative dollar impact (never 0) using the client's own data; if exact math is unavailable, estimate conservatively.
- Avoid generic advice; make it specific to the user's numbers and state.

 Non‑negotiable data rules (align with dashboard):
 - Emergency fund recommendations MUST use the Emergency Readiness Score from the dashboard as the source of truth (calculations.emergencyReadinessScoreCFP). Do not infer from income; base on monthly expenses only.
 - Retirement readiness MUST use the Monte Carlo success probability (percent, 0–100) from the dashboard. Do not use any legacy "retirement confidence" metric.
 - Do NOT provide Social Security claiming age optimization recommendations; a separate optimizer handles this elsewhere.

Estimation guidance (when exact figures aren’t possible):
- Tax/Roth/asset location: 0.2–0.5% of taxable brokerage annually.
- IRMAA mitigation: savings from avoiding 1–2 brackets for 1–2 years.
- SS timing: 6–15% lifetime improvement only if timing is suboptimal.
- Sequence-of-returns buffer: 0.3–0.7% of investable portfolio across first 3–5 years.
- Estate/document remediation: direct cost avoidance or % of estate value if probate/penalties avoided.
- Never return 0 for estimatedImpact; provide a conservative estimate instead.

Return ONLY valid JSON:
{
  "insights": [
    { "id": "string", "priority": 1|2|3, "title": "...", "explanation": "...", "estimatedImpact": number, "category": "Tax|Retirement|Cash Flow|Debt|Estate|Insurance|Education|Investments|Other" }
  ],
  "lastUpdated": "${new Date().toISOString()}"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      // Fallback minimal structure
      return { insights: [], lastUpdated: new Date().toISOString() };
    }
    const parsed = JSON.parse(match[0]);

    // Normalize and enforce non-zero impacts; ensure at least 10 items if possible
    if (Array.isArray(parsed.insights)) {
      parsed.insights = parsed.insights.map((i: any, idx: number) => {
        const impact = Number(i?.estimatedImpact);
        let safeImpact = impact;
        if (!isFinite(impact) || impact <= 0) {
          const baseFromAssets = Math.max(0, taxableBrokerageTotal || totalAssets) * 0.002; // 0.2%
          const baseFromBudget = Math.max(0, annualBudget) * 0.02; // 2% annual budget
          safeImpact = Math.max(500, Math.round((baseFromAssets || 0) + (baseFromBudget || 0)));
        }
        return {
          id: i.id || `ci-${idx + 1}`,
          priority: (i.priority === 1 || i.priority === 2) ? i.priority : 3,
          title: i.title || 'Personalized Recommendation',
          explanation: i.explanation || i.description || 'Actionable step tailored to your profile.',
          estimatedImpact: Math.round(safeImpact),
          category: i.category || 'Other'
        };
      });
      // If fewer than 10, keep as-is; prompt aims for 10–12
    } else {
      parsed.insights = [];
    }
    return parsed;
  }
  async function generateRetirementInsights(userId: number, profile: any): Promise<any> {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key not configured");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

      // Pull relevant persisted retirement data
      const planning = profile.retirementPlanningData || {};
      const variables = (profile.optimizationVariables as any) || {};
      const mc = (profile.monteCarloSimulation as any) || {};
      const netWorth = planning.netWorthProjections || variables.netWorthProjections;
      const cashFlows = planning.cashFlowProjections || variables.cashFlowData || mc.yearlyCashFlows;
      const ssOpt = profile.socialSecurityOptimization || variables.socialSecurityOptimization || null;

      const formatCurrency = (n: any) => (n || n === 0) ? `$${Number(n).toLocaleString()}` : 'N/A';
      const toPct = (n: any) => (typeof n === 'number') ? `${n.toFixed(1)}%` : (n ? `${Number(n).toFixed?.(1) ?? n}%` : 'N/A');

      // Build asset totals to ensure the model considers portfolio sufficiency
      const assets: any[] = Array.isArray(profile.assets) ? profile.assets : [];
      const lower = (s: any) => (typeof s === 'string' ? s.toLowerCase() : '');
      const isRetirement = (t: string) => /401k|403b|ira|retirement|pension|457|tsp/.test(lower(t));
      const isBrokerage = (t: string) => /brokerage|investment|taxable|etf|stock|fund/.test(lower(t));
      const isCash = (t: string) => /cash|savings|checking|money market/.test(lower(t));
      const sumBy = (pred: (t: string)=>boolean) => assets
        .filter(a => a && pred(a.type || ''))
        .reduce((s, a) => s + (Number(a.value) || 0), 0);
      const retirementAssetsTotal = sumBy(isRetirement);
      const taxableBrokerageTotal = sumBy(isBrokerage);
      const cashLikeTotal = sumBy(isCash);
      const totalInvestable = retirementAssetsTotal + taxableBrokerageTotal + cashLikeTotal;
      const monthlyExpenses = Number(variables.monthlyExpenses || profile.expectedMonthlyExpensesRetirement || 0) || 0;
      const annualBudget = monthlyExpenses * 12;

      // Determine sufficiency from saved analytics
      const baseline = planning.baselineScore;
      const optimized = planning.optimizedScore ?? mc.probabilityOfSuccess;
      const successPct = typeof optimized === 'number' ? optimized : (typeof baseline === 'number' ? baseline : null);
      const sufficientFromMC = typeof successPct === 'number' && successPct >= 80;
      const sufficientFromBalance = typeof mc.medianEndingBalance === 'number' && mc.medianEndingBalance > 0;
      const isSufficient = !!(sufficientFromMC || sufficientFromBalance || totalInvestable > 0);

      // Derive quick gap-year signal from retirement vs SS ages
      const userRetAge = variables.retirementAge || profile.desiredRetirementAge;
      const spouseRetAge = variables.spouseRetirementAge || profile.spouseDesiredRetirementAge;
      const userSSAge = variables.socialSecurityAge || profile.socialSecurityClaimAge;
      const spouseSSAge = variables.spouseSocialSecurityAge || profile.spouseSocialSecurityClaimAge;
      const hasSpouse = profile.maritalStatus === 'married' || profile.maritalStatus === 'partnered';
      const minRet = Math.min(
        Number.isFinite(Number(userRetAge)) ? Number(userRetAge) : 65,
        hasSpouse && Number.isFinite(Number(spouseRetAge)) ? Number(spouseRetAge) : (Number(userRetAge) || 65)
      );
      const minSS = Math.min(
        Number.isFinite(Number(userSSAge)) ? Number(userSSAge) : 67,
        hasSpouse && Number.isFinite(Number(spouseSSAge)) ? Number(spouseSSAge) : (Number(userSSAge) || 67)
      );
      const potentialGapYears = Math.max(0, Math.round(minSS - minRet));

      const context = `
RETIREMENT PLANNING SUMMARY (persisted from user activity):

CONFIDENCE SCORES:
- Baseline Success Probability: ${toPct(planning.baselineScore)}
- Optimized Success Probability: ${toPct(planning.optimizedScore)}
- Improvement: ${planning.improvement ? toPct(planning.improvement) : 'N/A'}

KEY VARIABLES (Selected Plan):
- Retirement Age (User): ${variables.retirementAge || profile.desiredRetirementAge || 'Not set'}
- Retirement Age (Spouse): ${variables.spouseRetirementAge || profile.spouseDesiredRetirementAge || 'Not set'}
- Social Security Age (User): ${variables.socialSecurityAge || profile.socialSecurityClaimAge || 'Not set'}
- Social Security Age (Spouse): ${variables.spouseSocialSecurityAge || profile.spouseSocialSecurityClaimAge || 'Not set'}
- Monthly Expenses (Retirement): ${formatCurrency(variables.monthlyExpenses || profile.expectedMonthlyExpensesRetirement)}
- Part-time Income (User/Spouse): ${formatCurrency(variables.partTimeIncome || 0)} / ${formatCurrency(variables.spousePartTimeIncome || 0)}
 - Annual Retirement Budget: ${formatCurrency(annualBudget)}

MONTE CARLO HIGHLIGHTS:
- Current Effective Tax Rate (if available): ${mc.effectiveTaxRate ?? 'N/A'}
- Median Ending Balance: ${formatCurrency(mc.medianEndingBalance)}
- Cash Flow Records: ${Array.isArray(cashFlows) ? cashFlows.length : 0}

SOCIAL SECURITY OPTIMIZATION:
${ssOpt ? `- Optimal SS Ages: User ${ssOpt.user?.optimalAge ?? variables.socialSecurityAge ?? profile.socialSecurityClaimAge}${hasSpouse && (ssOpt.spouse?.optimalAge || variables.spouseSocialSecurityAge || profile.spouseSocialSecurityClaimAge) ? ", Spouse " + (ssOpt.spouse?.optimalAge ?? variables.spouseSocialSecurityAge ?? profile.spouseSocialSecurityClaimAge) : ''}
- Lifetime Benefit Gain (Nominal): ${formatCurrency((ssOpt.user?.nominalDifference || 0) + (ssOpt.spouse?.nominalDifference || 0))}
- Sustainable Annual Spending (if calculated): ${formatCurrency(ssOpt.sustainableAnnualSpending)}
- Confidence: ${toPct((ssOpt.confidence || 0) * 100)}
` : '- Optimal SS ages calculated in app; consider timing impacts'}

GAP YEARS (pre-SS):
- Potential gap-years between earliest retirement age and SS start: ~${potentialGapYears} years (estimate based on selected ages)

NET WORTH PROJECTIONS:
- Years: ${Array.isArray(netWorth?.years) ? netWorth.years.slice(0,3).join(', ') + (netWorth.years.length>3?'...':'') : 'N/A'}
- Values: ${Array.isArray(netWorth?.values) ? netWorth.values.slice(0,3).map(formatCurrency).join(', ') + (netWorth.values.length>3?'...':'') : 'N/A'}

PORTFOLIO SUMMARY:
- Retirement Accounts Total: ${formatCurrency(retirementAssetsTotal)}
- Taxable Brokerage Total: ${formatCurrency(taxableBrokerageTotal)}
- Cash & Cash-like: ${formatCurrency(cashLikeTotal)}
- Total Investable Assets: ${formatCurrency(totalInvestable)}
${isSufficient ? '- Sufficiency Signal: Portfolio appears sufficient for planned retirement (>=80% success or positive median ending balance).\n' : ''}

STRESS TESTS (if tracked): Consider sequence of returns, inflation shocks, expense cliffs, healthcare, and longevity.
SOCIAL SECURITY OPTIMIZATION: Consider claiming age impacts on lifetime income and survivor benefits.
`;

      const prompt = `
You are a CFP professional. Analyze the retirement planning data above and return 5-8 high-impact insights.
Think hard.
Rules:
- Rank insights by priority: 1 (highest) to 3 (lower)
- Each insight must include: title, action (specific next step), why (why it matters), and an estimated dollar impact (positive = savings/benefit)
- Focus areas: success probability drivers, cash-flow risks, sequence-of-returns risk, Social Security timing impact, expense optimization, portfolio longevity, and net worth trajectory.
- Use conservative, practical, compliance-friendly language.

Hard constraints:
- If the plan is sufficient (>=80% success probability and/or positive median ending balance, or substantial investable assets), DO NOT recommend:
  • working longer, delaying retirement, taking a side job, or increasing earned income
  • materially increasing savings/contributions or cutting lifestyle expenses
  Instead, focus on optimization levers (tax efficiency, withdrawal order, Roth conversion windows, asset location, IRMAA mitigation, cash bucket for sequence-of-returns, SS coordination, RMD smoothing, LTC/HSA planning).
- All dollar impacts must reflect benefits from optimization (e.g., tax savings, improved net-of-tax outcomes), not hypothetical added income.

Estimation guidance (if exact figures are not available):
- Roth conversion/arbitrage: estimate after-tax benefit conservatively at 2–5% of the converted amount; base conversion sizing on available lower-bracket window and annualBudget.
- Asset location/fee improvement: estimate at 0.2–0.5% of taxableBrokerageTotal per year.
- IRMAA mitigation: estimate cumulative savings based on avoiding 1–2 brackets for 2 years.
- Sequence-of-returns cash bucket: estimate benefit at 0.3–0.7% of totalInvestable across first 3–5 years depending on risk profile.
- Social Security timing: estimate lifetime benefit difference using 6–15% improvement when delaying past current plan (only if timing is suboptimal).
- Never return 0 for estimatedImpact; when uncertain, return a conservative estimate using the guidance above.

Return ONLY valid JSON like:
{
  "insights": [
    { "id": "string", "priority": 1|2|3, "title": "...", "action": "...", "why": "...", "estimatedImpact": number }
  ],
  "lastUpdated": "${new Date().toISOString()}"
}
`;

      const result = await model.generateContent(context + "\n\n" + prompt);
      const text = result.response.text();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        // Post-process to remove misaligned recommendations when plan is sufficient
        if (isSufficient && Array.isArray(parsed.insights)) {
          const banned = /(work longer|delay retirement|take a side job|side\s*income|increase savings|increase contributions|cut spending|reduce expenses|downsize|sell home)/i;
          parsed.insights = parsed.insights.filter((i: any) => {
            if (!i || typeof i.title !== 'string') return false;
            const txt = `${i.title} ${i.explanation || ''} ${i.why || ''} ${i.action || ''}`;
            return !banned.test(txt);
          });
        }
        // Ensure non-zero, conservative estimatedImpact using available magnitudes and map optional fields
        if (Array.isArray(parsed.insights)) {
          parsed.insights = parsed.insights.map((i: any, idx: number) => {
            let impact = Number(i?.estimatedImpact);
            if (!isFinite(impact) || impact <= 0) {
              // Conservative fallback: small percent of taxable assets or annual budget
              const baseFromAssets = Math.max(0, taxableBrokerageTotal) * 0.003; // 0.3%
              const baseFromBudget = Math.max(0, annualBudget) * 0.02; // 2% of annual budget
              const fallback = Math.max(500, Math.round((baseFromAssets || 0) + (baseFromBudget || 0)));
              impact = fallback;
            }
            return {
              id: i.id || `ri-${idx + 1}`,
              priority: (i.priority === 1 || i.priority === 2) ? i.priority : 3,
              title: i.title || 'Personalized Recommendation',
              action: i.action || i.nextStep || i.recommendation || 'Follow the outlined step to capture the benefit.',
              why: i.why || i.explanation || i.rationale || 'Improves retirement readiness and tax efficiency.',
              estimatedImpact: Math.round(impact)
            };
          });
        }
        return parsed;
      }
      throw new Error('Could not parse AI response');
    } catch (error) {
      console.error('Retirement insights generation failed:', error);
      // Fallback example insights
      return {
        insights: [
          { id: 'ss-timing', priority: 1, title: 'Optimize Social Security Timing', action: 'Set claiming ages to the optimal plan in the Social Security tab.', why: 'Delaying appropriately can raise lifetime benefits and survivor protection.', estimatedImpact: 25000 },
          { id: 'gap-funding', priority: 1, title: 'Pre-fund Gap Years (Cash Bucket)', action: 'Hold 3–5 years of withdrawals in cash/short-duration until SS starts.', why: 'Reduces sequence‑of‑returns risk while bridging pre‑SS income needs.', estimatedImpact: 12000 },
          { id: 'roth-window', priority: 2, title: 'Use Roth Conversion Windows', action: 'Convert in low-bracket years before RMDs/SS to smooth taxes.', why: 'Lowers lifetime taxes and improves net after‑tax longevity.', estimatedImpact: 10000 },
          { id: 'asset-location', priority: 2, title: 'Improve Asset Location', action: 'Place tax‑inefficient assets in tax‑advantaged accounts where feasible.', why: 'Cuts annual tax drag; improves compounding of taxable account.', estimatedImpact: 5000 },
          { id: 'irmaa-planning', priority: 3, title: 'Plan Around IRMAA', action: 'Keep MAGI below IRMAA thresholds in key years (use QCDs, timing).', why: 'Avoiding one bracket for two years can save material premiums.', estimatedImpact: 3000 }
        ],
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // Clear tax analysis data
  app.delete("/api/tax-analysis-result", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const userId = req.user!.id;
      
      // Clear tax analysis data
      await storage.updateFinancialProfile(userId, {
        taxReturns: null,
      });
      
      res.json({ message: "Tax analysis data cleared successfully" });
    } catch (error) {
      console.error("Error clearing tax analysis:", error);
      res.status(500).json({ error: "Failed to clear tax analysis" });
    }
  });

  // Get tax overview calculations
  app.get("/api/tax-overview", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const profile = await storage.getFinancialProfile(req.user!.id);
      
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }

      // Check if we have extracted tax data from a tax return
      if (profile.taxReturns?.extractedTaxData?.adjustedGrossIncome > 0) {
        // Use accurate data from tax return
        const extractedData = profile.taxReturns.extractedTaxData;
        res.json({
          grossHouseholdIncome: extractedData.adjustedGrossIncome,
          totalDeductions: extractedData.totalDeductions,
          taxableIncome: extractedData.taxableIncome,
          effectiveTaxRate: profile.taxReturns.effectiveTaxRate || 0,
          marginalTaxRate: profile.taxReturns.marginalTaxRate || 0,
          projectedFederalTax: extractedData.federalTaxesPaid,
          projectedStateTax: extractedData.stateTaxesPaid || 0,
          projectedTotalTax: extractedData.federalTaxesPaid + (extractedData.stateTaxesPaid || 0),
          currentTaxYear: new Date().getFullYear() - 1, // Tax return is for previous year
          isFromTaxReturn: true
        });
      } else {
        // Calculate tax overview from profile data
        const taxOverview = calculateTaxOverview(profile);
        res.json({
          ...taxOverview,
          isFromTaxReturn: false
        });
      }
    } catch (error) {
      console.error("Error calculating tax overview:", error);
      res.status(500).json({ error: "Failed to calculate tax overview" });
    }
  });

  // Investment center endpoints
  app.get("/api/investments/:category", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { category } = req.params;
      const { refresh } = req.query;
      const validCategories = ["market", "ai_infra", "ai_software", "cloud_saas", "cybersec"];
      
      if (!validCategories.includes(category)) {
        return res.status(400).json({ error: "Invalid investment category" });
      }

      // Check cache first unless refresh is requested
      if (!refresh) {
        const cachedData = await storage.getInvestmentCache(req.user!.id, category);
        if (cachedData) {
          return res.json(cachedData.data);
        }
      }

      // Import the investments module
      const { getInvestmentData } = await import("./investments");
      
      // Simulate loading time for perceived depth
      const startTime = Date.now();
      const data = await getInvestmentData(category);
      
      // Cache the data
      await storage.setInvestmentCache(req.user!.id, category, data, 6); // 6 hour TTL
      
      // Ensure minimum 2 second response time for UX
      const elapsed = Date.now() - startTime;
      if (elapsed < 2000) {
        await new Promise(resolve => setTimeout(resolve, 2000 - elapsed));
      }

      res.json(data);
    } catch (error) {
      console.error("Error fetching investment data:", error);
      res.status(500).json({ error: "Failed to fetch investment data" });
    }
  });

  // Goals-Based Planning Center endpoints
  
  // Get all goals for a user
  app.get("/api/goals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goals = await storage.getGoals(req.user!.id);
      res.json(goals);
    } catch (error) {
      next(error);
    }
  });

  // Get a single goal
  app.get("/api/goals/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goal = await storage.getGoal(req.user!.id, parseInt(req.params.id));
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      res.json(goal);
    } catch (error) {
      next(error);
    }
  });

  // Create a new goal
  app.post("/api/goals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      console.log('Creating goal with data:', req.body);
      
      const goal = await storage.createGoal(req.user!.id, req.body);
      
      // Log for audit
      await storage.createGoalAuditLog({
        userId: req.user!.id,
        goalId: goal.id,
        action: 'create',
        entityType: 'goal',
        newValues: goal,
      });
      
      res.status(201).json(goal);
    } catch (error) {
      console.error('Error creating goal:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create goal' });
    }
  });

  // Update a goal
  app.patch("/api/goals/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const oldGoal = await storage.getGoal(req.user!.id, goalId);
      if (!oldGoal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      
      const updatedGoal = await storage.updateGoal(req.user!.id, goalId, req.body);
      
      // Log for audit
      await storage.createGoalAuditLog({
        userId: req.user!.id,
        goalId: goalId,
        action: 'update',
        entityType: 'goal',
        oldValues: oldGoal,
        newValues: updatedGoal,
      });
      
      res.json(updatedGoal);
    } catch (error) {
      next(error);
    }
  });

  // Delete a goal
  app.delete("/api/goals/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const goal = await storage.getGoal(req.user!.id, goalId);
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      
      await storage.deleteGoal(req.user!.id, goalId);
      
      // Log for audit
      await storage.createGoalAuditLog({
        userId: req.user!.id,
        goalId: goalId,
        action: 'delete',
        entityType: 'goal',
        oldValues: goal,
      });
      
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Calculate probabilities for all goals
  app.get("/api/goals/probability", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goals = await storage.getGoals(req.user!.id);
      const profile = await storage.getFinancialProfile(req.user!.id);
      
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      // Calculate probability for each goal using Monte Carlo
      const probabilities = await Promise.all(
        goals.map(async (goal) => {
          const probability = await calculateGoalProbability(goal, profile);
          
          // Update cached probability
          await storage.updateGoal(req.user!.id, goal.id, {
            probabilityOfSuccess: probability,
            lastCalculatedAt: new Date(),
          } as any);
          
          return {
            goalId: goal.id,
            probabilityPct: probability,
          };
        })
      );
      
      res.json(probabilities);
    } catch (error) {
      next(error);
    }
  });

  // Goal Tasks endpoints
  
  // Get tasks for a goal
  app.get("/api/goals/:goalId/tasks", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const tasks = await storage.getGoalTasks(req.user!.id, parseInt(req.params.goalId));
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  });

  // Create a task
  app.post("/api/goals/:goalId/tasks", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const task = await storage.createGoalTask(req.user!.id, parseInt(req.params.goalId), req.body);
      
      // Log for audit
      await storage.createGoalAuditLog({
        userId: req.user!.id,
        taskId: task.id,
        goalId: parseInt(req.params.goalId),
        action: 'create',
        entityType: 'task',
        newValues: task,
      });
      
      res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  });

  // Update a task
  app.patch("/api/tasks/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const taskId = parseInt(req.params.id);
      const oldTask = await storage.getGoalTask(req.user!.id, taskId);
      if (!oldTask) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      const updatedTask = await storage.updateGoalTask(req.user!.id, taskId, req.body);
      
      // Log for audit
      await storage.createGoalAuditLog({
        userId: req.user!.id,
        taskId: taskId,
        goalId: oldTask.goalId,
        action: 'update',
        entityType: 'task',
        oldValues: oldTask,
        newValues: updatedTask,
      });
      
      res.json(updatedTask);
    } catch (error) {
      next(error);
    }
  });

  // Delete a task
  app.delete("/api/tasks/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const taskId = parseInt(req.params.id);
      const task = await storage.getGoalTask(req.user!.id, taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await storage.deleteGoalTask(req.user!.id, taskId);
      
      // Log for audit
      await storage.createGoalAuditLog({
        userId: req.user!.id,
        taskId: taskId,
        goalId: task.goalId,
        action: 'delete',
        entityType: 'task',
        oldValues: task,
      });
      
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Action Plan Task endpoints
  
  // Get all action plan tasks for the user
  app.get("/api/action-plan-tasks", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const tasks = await storage.getActionPlanTasks(req.user!.id);
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  });
  
  // Toggle task completion status
  app.patch("/api/action-plan-tasks/:taskId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { taskId } = req.params;
      const { isCompleted, recommendationTitle } = req.body;
      
      // Check if task exists
      const existingTask = await storage.getActionPlanTask(req.user!.id, taskId);
      
      if (existingTask) {
        // Update existing task
        const updatedTask = await storage.updateActionPlanTask(req.user!.id, taskId, {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        });
        res.json(updatedTask);
      } else {
        // Create new task
        const newTask = await storage.createActionPlanTask(req.user!.id, {
          taskId,
          recommendationTitle,
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        });
        res.status(201).json(newTask);
      }
    } catch (error) {
      next(error);
    }
  });

  // Monte Carlo simulation for What-If Sandbox (merge-safe, prevents clobbering)
  app.put("/api/monte-carlo-simulation", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const profile = await storage.getFinancialProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }

      const incoming = req.body || {};
      const currentMC: any = (profile as any)?.monteCarloSimulation || {};
      const merged: any = {
        ...currentMC,
        ...incoming,
        retirementSimulation: {
          ...(currentMC?.retirementSimulation || {}),
          ...(incoming?.retirementSimulation || {}),
        },
      };
      if (!incoming?.retirementSimulation?.results && currentMC?.retirementSimulation?.results) {
        merged.retirementSimulation.results = currentMC.retirementSimulation.results;
      }

      await storage.updateFinancialProfile(req.user!.id, {
        monteCarloSimulation: merged,
      });

      res.json({ message: "Simulation state updated successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Calculate optimal Social Security claim ages
  app.post('/api/calculate-optimal-ss-claim', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const profile = await storage.getFinancialProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Use the unified LifetimeCashFlowOptimizer for consistency
      const { LifetimeCashFlowOptimizer } = await import("./lifetime-cashflow-optimizer");
      
      // Calculate optimal ages using the same NPV algorithm
      const optimalResult = LifetimeCashFlowOptimizer.calculateOptimalAgesFromProfile(profile);
      
      if (!optimalResult) {
        return res.status(500).json({ error: 'Failed to calculate optimal ages' });
      }

      // Create optimizer instance for calculations
      const optimizer = new LifetimeCashFlowOptimizer(profile);
      
      // Helper to calculate NPV, nominal value, and monthly benefit for a specific claiming age
      const calculateDetailsForAge = (
        age: number, 
        benefit: number, 
        currentAge: number,
        fra: number = 67
      ): { npv: number; nominal: number; monthlyBenefit: number } => {
        const discountRate = 0.03;
        const colaRate = 0.025;
        const longevityAge = 93; // Standard longevity age for optimization
        
        // Calculate monthly benefit at this age
        const monthlyBenefit = optimizer.calculateSSBenefit(benefit, age) / 12;
        
        // Calculate both NPV and nominal values
        let totalNPV = 0;
        let totalNominal = 0;
        const annualBenefit = optimizer.calculateSSBenefit(benefit, age);
        
        for (let yearAge = age; yearAge <= longevityAge; yearAge++) {
          const yearsFromClaim = yearAge - age;
          const yearsFromNow = yearAge - currentAge;
          
          // Apply COLA adjustment
          const adjustedBenefit = annualBenefit * Math.pow(1 + colaRate, yearsFromClaim);
          
          // Add to nominal total (no discounting)
          totalNominal += adjustedBenefit;
          
          // Discount to present value for NPV
          const discountFactor = Math.pow(1 + discountRate, yearsFromNow);
          const presentValue = adjustedBenefit / discountFactor;
          
          totalNPV += presentValue;
        }
        
        return { npv: totalNPV, nominal: totalNominal, monthlyBenefit };
      };

      // Get current ages
      const userCurrentAge = profile.dateOfBirth ? 
        new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : 65;
      const spouseCurrentAge = profile.spouseDateOfBirth ? 
        new Date().getFullYear() - new Date(profile.spouseDateOfBirth).getFullYear() : 65;

      // Get retirement ages
      const userRetirementAge = profile.desiredRetirementAge || 65;
      const spouseRetirementAge = profile.spouseDesiredRetirementAge || 65;

      // Calculate details for user at retirement age and optimal age
      const userRetirementDetails = calculateDetailsForAge(
        userRetirementAge,
        profile.socialSecurityBenefit || 0,
        userCurrentAge
      );
      
      const userOptimalDetails = calculateDetailsForAge(
        optimalResult.optimalUserAge,
        profile.socialSecurityBenefit || 0,
        userCurrentAge
      );

      // Format response with all calculated values
      const response: any = {
        user: {
          optimalAge: optimalResult.optimalUserAge,
          retirementAge: userRetirementAge,
          currentAge: userCurrentAge,
          
          // NPV values (discounted to present value)
          optimalNPV: Math.round(userOptimalDetails.npv),
          retirementNPV: Math.round(userRetirementDetails.npv),
          npvDifference: Math.round(userOptimalDetails.npv - userRetirementDetails.npv),
          
          // Nominal values (not discounted) - cumulative lifetime benefits
          optimalNominal: Math.round(userOptimalDetails.nominal),
          retirementNominal: Math.round(userRetirementDetails.nominal),
          nominalDifference: Math.round(userOptimalDetails.nominal - userRetirementDetails.nominal),
          
          // Monthly benefits
          optimalMonthlyBenefit: Math.round(userOptimalDetails.monthlyBenefit),
          retirementMonthlyBenefit: Math.round(userRetirementDetails.monthlyBenefit),
          monthlyIncrease: userRetirementDetails.monthlyBenefit > 0 ? 
            ((userOptimalDetails.monthlyBenefit - userRetirementDetails.monthlyBenefit) / userRetirementDetails.monthlyBenefit) * 100 : 0
        }
      };

      // Calculate for spouse if married
      if (profile.maritalStatus === 'married' && optimalResult.optimalSpouseAge && profile.spouseSocialSecurityBenefit) {
        const spouseRetirementDetails = calculateDetailsForAge(
          spouseRetirementAge,
          profile.spouseSocialSecurityBenefit || 0,
          spouseCurrentAge
        );
        
        const spouseOptimalDetails = calculateDetailsForAge(
          optimalResult.optimalSpouseAge,
          profile.spouseSocialSecurityBenefit || 0,
          spouseCurrentAge
        );
        
        response.spouse = {
          optimalAge: optimalResult.optimalSpouseAge,
          retirementAge: spouseRetirementAge,
          currentAge: spouseCurrentAge,
          
          // NPV values
          optimalNPV: Math.round(spouseOptimalDetails.npv),
          retirementNPV: Math.round(spouseRetirementDetails.npv),
          npvDifference: Math.round(spouseOptimalDetails.npv - spouseRetirementDetails.npv),
          
          // Nominal values (not discounted) - cumulative lifetime benefits
          optimalNominal: Math.round(spouseOptimalDetails.nominal),
          retirementNominal: Math.round(spouseRetirementDetails.nominal),
          nominalDifference: Math.round(spouseOptimalDetails.nominal - spouseRetirementDetails.nominal),
          
          // Monthly benefits
          optimalMonthlyBenefit: Math.round(spouseOptimalDetails.monthlyBenefit),
          retirementMonthlyBenefit: Math.round(spouseRetirementDetails.monthlyBenefit),
          monthlyIncrease: spouseRetirementDetails.monthlyBenefit > 0 ?
            ((spouseOptimalDetails.monthlyBenefit - spouseRetirementDetails.monthlyBenefit) / spouseRetirementDetails.monthlyBenefit) * 100 : 0
        };
      }

      res.json(response);
    } catch (error) {
      console.error('Error calculating optimal SS ages:', error);
      res.status(500).json({ error: 'Failed to calculate optimal ages' });
    }
  });

  // Recalculate financial metrics for existing profiles
  app.post("/api/financial-profile/recalculate", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      // Get current profile
      const profile = await storage.getFinancialProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      // Get estate documents for recommendations
      const estateDocuments = await storage.getEstateDocuments(req.user!.id);
      
      // Recalculate all metrics with the fixed logic
      const calculations = await calculateFinancialMetrics(profile, estateDocuments);
      
      // Update profile with new calculations and individual scores
      const updatedProfile = await storage.updateFinancialProfile(req.user!.id, {
        calculations,
        // Store financial health score as separate field for easy retrieval
        financialHealthScore: Math.round(Number(calculations?.healthScore) || 0),
        // Store other scores separately for dashboard
        emergencyReadinessScore: Math.round(Number(calculations?.emergencyScore) || 0),
        retirementReadinessScore: Math.round(Number(calculations?.retirementScore) || 0),
        riskManagementScore: Math.round(Number(calculations?.insuranceScore) || 0),
        cashFlowScore: Math.round(Number(calculations?.cashFlowScore) || 0),
        // Store core financial metrics for dashboard widgets
        netWorth: calculations?.netWorth || 0,
        monthlyCashFlow: calculations?.monthlyCashFlow || 0,
        // Store risk profiles and allocations for Investment Profile widgets
        userRiskProfile: calculations?.riskProfile || 'Not Assessed',
        targetAllocation: calculations?.targetAllocation || {},
        spouseRiskProfile: calculations?.spouseRiskProfile || 'Not Assessed',
        spouseTargetAllocation: calculations?.spouseTargetAllocation || {},
      });
      
      res.json({
        message: "Financial metrics recalculated successfully",
        calculations: calculations
      });
    } catch (error) {
      next(error);
    }
  });

  // Estate Planning Routes
  app.get("/api/estate-plan", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const plan = await storage.getEstatePlan(req.user!.id);
      
      if (plan) {
        // Calculate estate tax estimates and analysis
        const analysis = await calculateEstateAnalysis(plan, req.user!.id);
        res.json({ ...plan, analysis });
      } else {
        res.json(null);
      }
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/estate-plan", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const plan = await storage.createEstatePlan(req.user!.id, req.body);
      res.json(plan);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/estate-plan/:planId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const planId = parseInt(req.params.planId);
      const plan = await storage.updateEstatePlan(req.user!.id, planId, req.body);
      res.json(plan);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/estate-plan/insights", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const userId = req.user!.id;
      const estatePlan = await storage.getEstatePlan(userId);
      if (!estatePlan) {
        return res.status(400).json({ error: "Estate plan not found" });
      }

      const context = await assembleEstateInsightsContext(userId, estatePlan);
      const insights: EstateInsightsPayload = await generateEstateInsightsFromContext(context);

      const currentAnalysis = (estatePlan.analysisResults || {}) as Record<string, any>;
      const estateNew = { ...(currentAnalysis.estateNew || {}) };
      estateNew.insights = insights;

      const updatedAnalysis = { ...currentAnalysis, estateNew };

      await storage.updateEstatePlan(userId, estatePlan.id, { analysisResults: updatedAnalysis });

      res.json({ insights });
    } catch (error) {
      next(error);
    }
  });

  // Estate Documents
  app.get("/api/estate-documents", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const estatePlanId = req.query.estatePlanId ? parseInt(req.query.estatePlanId as string) : undefined;
      const documents = await storage.getEstateDocuments(req.user!.id, estatePlanId);
      res.json(documents);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/estate-documents", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const document = await storage.createEstateDocument(req.user!.id, req.body);
      res.json(document);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/estate-documents/:documentId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const documentId = parseInt(req.params.documentId);
      const document = await storage.updateEstateDocument(req.user!.id, documentId, req.body);
      res.json(document);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/estate-documents/:documentId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const documentId = parseInt(req.params.documentId);
      await storage.deleteEstateDocument(req.user!.id, documentId);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Estate Document Upload and Parsing
  const uploadEstateDoc = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed') as any);
      }
    }
  });

  // Will generation (MVP): builds a simple Last Will & Testament DOCX and a self-proving affidavit DOCX
  app.post("/api/estate/will/generate", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { inputs } = req.body || {};
      const userId = req.user!.id;

      // Lazy import to avoid cold start cost
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      const fs = await import('fs/promises');
      const path = await import('path');

      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

      // Basic intake
      const testatorName = String(inputs?.testatorName || (req.user as any)?.firstName || "Testator");
      const spouseName = String(inputs?.spouseName || (inputs?.maritalStatus === 'married' ? ("Spouse") : ""));
      const state = String(inputs?.state || (inputs?.profileState || (req as any)?.user?.state) || "");
      const executor = String(inputs?.executorName || "Executor Name");
      const altExecutor = String(inputs?.altExecutorName || "");
      const guardian = String(inputs?.guardianName || "Guardian Name");
      const altGuardian = String(inputs?.altGuardianName || "");
      const residuary = String(inputs?.residuaryPlan || "All to my spouse, or to my children by representation.");
      const survivorshipDays = Number.isFinite(Number(inputs?.survivorshipDays)) ? Math.max(0, Number(inputs?.survivorshipDays)) : 0;
      const noContest = Boolean(inputs?.noContest);
      const petGuardian = String(inputs?.petGuardian || "");
      const funeralPrefs = String(inputs?.funeralPrefs || "");
      const distMethod = String(inputs?.distMethod || 'per-stirpes');

      // Build Will DOCX (include basic clauses: revocation, executor, guardianship, specific bequests, residuary, digital assets)
      const willDoc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: "LAST WILL AND TESTAMENT", heading: HeadingLevel.HEADING_1 }),
              new Paragraph({ text: `I, ${testatorName}, of ${state}, declare this to be my Last Will and Testament.` }),
              new Paragraph({ text: "1. REVOCATION OF PRIOR WILLS." }),
              new Paragraph({ text: "I revoke all prior wills and codicils." }),
              new Paragraph({ text: "2. FAMILY INFORMATION." }),
              new Paragraph({ text: spouseName ? `I am married to ${spouseName}.` : "I am not married." }),
              new Paragraph({ text: "3. EXECUTOR." }),
              new Paragraph({ text: `I nominate ${executor} to serve as Executor of my estate, to serve without bond.` }),
              ...(altExecutor ? [ new Paragraph({ text: `If ${executor} is unable or unwilling to serve, I nominate ${altExecutor} as alternate Executor.` }) ] : []),
              new Paragraph({ text: "4. GUARDIAN OF MINOR CHILDREN." }),
              new Paragraph({ text: `If I leave minor children at my death, I nominate ${guardian} as guardian.` }),
              ...(altGuardian ? [ new Paragraph({ text: `If ${guardian} is unable or unwilling to serve, I nominate ${altGuardian} as alternate guardian.` }) ] : []),
              new Paragraph({ text: "5. SPECIFIC BEQUESTS." }),
              new Paragraph({ text: String(inputs?.specificBequests || "None.") }),
              new Paragraph({ text: "6. DISPOSITION OF RESIDUARY ESTATE." }),
              new Paragraph({ text: residuary }),
              ...(survivorshipDays ? [
                new Paragraph({ text: "7. SURVIVORSHIP." }),
                new Paragraph({ text: `A beneficiary must survive me by ${survivorshipDays} days to take under this Will.` })
              ] : []),
              new Paragraph({ text: `${survivorshipDays ? '8' : '7'}. OMITTED ITEMS; DIGITAL ASSETS.` }),
              new Paragraph({ text: "My Executor may access my digital assets consistent with applicable law (e.g., RUFADAA) and this Will." }),
              ...(petGuardian ? [
                new Paragraph({ text: `${survivorshipDays ? '9' : '8'}. PETS.` }),
                new Paragraph({ text: `I designate ${petGuardian} to care for my pets and authorize my Executor to distribute reasonable funds for their care.` })
              ] : []),
              ...(funeralPrefs ? [
                new Paragraph({ text: `${survivorshipDays ? (petGuardian? '10':'9') : (petGuardian? '9':'8')}. FUNERAL PREFERENCES.` }),
                new Paragraph({ text: funeralPrefs })
              ] : []),
              // Anti‑lapse and distribution method
              new Paragraph({ text: `${survivorshipDays ? (petGuardian? (funeralPrefs? '11':'10') : (funeralPrefs? '10':'9')) : (petGuardian? (funeralPrefs? '10':'9') : (funeralPrefs? '9':'8'))}. ANTI‑LAPSE; DISTRIBUTION METHOD.` }),
              new Paragraph({ text: distMethod === 'per-capita'
                ? "If any residuary beneficiary does not survive the survivorship period, that beneficiary's share shall pass per capita at each generation to the then‑living descendants of such beneficiary; if none, such share shall be added to the remaining residuary shares."
                : "If any residuary beneficiary does not survive the survivorship period, that beneficiary's share shall pass to their then‑living descendants, by representation (per stirpes); if none, such share shall be added to the remaining residuary shares." }),
              ...(noContest ? [
                new Paragraph({ text: `${survivorshipDays ? (petGuardian? (funeralPrefs? '12':'11') : (funeralPrefs? '11':'10')) : (petGuardian? (funeralPrefs? '11':'10') : (funeralPrefs? '10':'9'))}. NO‑CONTEST CLAUSE.` }),
                new Paragraph({ text: "Any beneficiary who contests this Will shall forfeit their interest to the extent permitted by law." })
              ] : []),
              new Paragraph({ text: "\nIN WITNESS WHEREOF, I have signed this Will on the date below." }),
              new Paragraph({ text: "\n______________________________" }),
              new Paragraph({ text: `${testatorName}, Testator` }),
              new Paragraph({ text: "\nSIGNED by the above-named Testator in our presence and then by us in the Testator’s presence and in the presence of each other:" }),
              new Paragraph({ text: "\nWitness 1: _________________________    Name: _________________________    Address: _________________________" }),
              new Paragraph({ text: "\nWitness 2: _________________________    Name: _________________________    Address: _________________________" }),
            ]
          }
        ]
      });

      const willBuffer = await Packer.toBuffer(willDoc);
      const willsDir = path.join(process.cwd(), 'uploads', 'wills');
      await fs.mkdir(willsDir, { recursive: true });
      const willFile = `will_${userId}_${stamp}.docx`;
      const willPath = path.join(willsDir, willFile);
      await fs.writeFile(willPath, willBuffer);

      // Build simple self‑proving affidavit DOCX (generic; user must verify availability in their state)
      const affDoc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: "SELF‑PROVING AFFIDAVIT", heading: HeadingLevel.HEADING_2 }),
              new Paragraph({ text: `STATE: ${state}  COUNTY: __________` }),
              new Paragraph({ text: `We, the undersigned, being duly sworn, declare that ${testatorName}, the Testator, signed the attached instrument as the Testator’s Last Will and Testament in our presence; that the Testator signed willingly, and that each of us, at the Testator’s request and in the Testator’s presence and in the presence of each other, signed our names as witnesses.` }),
              new Paragraph({ text: "\n______________________________  Testator" }),
              new Paragraph({ text: "\nWitness 1: ____________________________  Address: ____________________________" }),
              new Paragraph({ text: "\nWitness 2: ____________________________  Address: ____________________________" }),
              new Paragraph({ text: "\nSubscribed and sworn before me on ____________ by the Testator and witnesses above." }),
              new Paragraph({ text: "\n______________________________  Notary Public  My Commission Expires: ____________" })
            ]
          }
        ]
      });
      const affBuffer = await Packer.toBuffer(affDoc);
      const affFile = `affidavit_${userId}_${stamp}.docx`;
      const affPath = path.join(willsDir, affFile);
      await fs.writeFile(affPath, affBuffer);

      // Register document
      const estatePlan = await storage.getEstatePlan(userId);
      const created = await storage.createEstateDocument(userId, {
        estatePlanId: estatePlan?.id,
        documentType: 'will',
        documentName: 'Last Will and Testament',
        status: 'draft',
        notarized: false,
        witnesses: [],
        documentUrl: `/uploads/wills/${willFile}`,
        parsedInsights: { state, generatedAt: now.toISOString(), version: 'mvp-1' },
      } as any);

      // Create lightweight PDF versions using pdf-lib (plain text layout)
      try {
        const pdfLib = await import('pdf-lib');
        const { PDFDocument, StandardFonts, rgb } = pdfLib as any;

        // Will PDF
        const willPdf = await PDFDocument.create();
        const font = await willPdf.embedFont(StandardFonts.TimesRoman);
        const bold = await willPdf.embedFont(StandardFonts.TimesRomanBold);
        let page = willPdf.addPage();
        const margin = 50;
        let y = page.getSize().height - margin;
        const write = (text: string, size = 12, isBold = false, leading = 16) => {
          // Simple wrap: split at ~90 chars
          const maxChars = 90;
          const lines = [] as string[];
          let t = text;
          while (t.length > maxChars) {
            let idx = t.lastIndexOf(' ', maxChars);
            if (idx < 0) idx = maxChars;
            lines.push(t.slice(0, idx));
            t = t.slice(idx + 1);
          }
          lines.push(t);
          lines.forEach(line => {
            if (y < margin + leading) {
              page = willPdf.addPage();
              y = page.getSize().height - margin;
            }
            page.drawText(line, { x: margin, y, size, font: isBold ? bold : font, color: rgb(0,0,0) });
            y -= leading;
          });
        };
        const heading = (t: string) => write(t, 14, true, 20);
        heading('LAST WILL AND TESTAMENT');
        write(`Testator: ${testatorName}`);
        write('');
        write('1. REVOCATION OF PRIOR WILLS.', 12, true);
        write('I revoke all prior wills and codicils.');
        write('2. FAMILY INFORMATION.', 12, true);
        write(spouseName ? `I am married to ${spouseName}.` : 'I am not married.');
        write('3. EXECUTOR.', 12, true);
        write(`I nominate ${executor} to serve as Executor of my estate, to serve without bond.`);
        if (altExecutor) write(`If ${executor} is unable or unwilling to serve, I nominate ${altExecutor} as alternate Executor.`);
        write('4. GUARDIAN OF MINOR CHILDREN.', 12, true);
        write(`If I leave minor children at my death, I nominate ${guardian} as guardian.`);
        if (altGuardian) write(`If ${guardian} is unable or unwilling to serve, I nominate ${altGuardian} as alternate guardian.`);
        write('5. SPECIFIC BEQUESTS.', 12, true);
        write(String(inputs?.specificBequests || 'None.'));
        write('6. DISPOSITION OF RESIDUARY ESTATE.', 12, true);
        write(residuary);
        if (survivorshipDays) {
          write('7. SURVIVORSHIP.', 12, true);
          write(`A beneficiary must survive me by ${survivorshipDays} days to take under this Will.`);
        }
        const idxBase = survivorshipDays ? 8 : 7;
        write(`${idxBase}. OMITTED ITEMS; DIGITAL ASSETS.`, 12, true);
        write('My Executor may access my digital assets consistent with applicable law (e.g., RUFADAA) and this Will.');
        let idx = idxBase + 1;
        if (petGuardian) { write(`${idx}. PETS.`, 12, true); write(`I designate ${petGuardian} to care for my pets and authorize my Executor to distribute reasonable funds for their care.`); idx++; }
        if (funeralPrefs) { write(`${idx}. FUNERAL PREFERENCES.`, 12, true); write(funeralPrefs); idx++; }
        // Anti-lapse and distribution method default for residuary
        write(`${idx}. ANTI‑LAPSE; DISTRIBUTION METHOD.`, 12, true);
        if (distMethod === 'per-capita') {
          write('If any residuary beneficiary does not survive the survivorship period, that beneficiary\'s share shall pass per capita at each generation to the then‑living descendants of such beneficiary; if none, such share shall be added to the remaining residuary shares.');
        } else {
          write('If any residuary beneficiary does not survive the survivorship period, that beneficiary\'s share shall pass to their then‑living descendants, by representation (per stirpes); if none, such share shall be added to the remaining residuary shares.');
        }
        if (noContest) { idx++; write(`${idx}. NO‑CONTEST CLAUSE.`, 12, true); write('Any beneficiary who contests this Will shall forfeit their interest to the extent permitted by law.'); }
        // Signature block
        if (y < 140) { page = willPdf.addPage(); y = page.getSize().height - margin; }
        write(''); write('IN WITNESS WHEREOF, I have signed this Will on the date below.');
        y -= 10;
        // lines
        const line = (label: string) => {
          page.drawLine({ start: { x: margin, y: y }, end: { x: page.getSize().width - margin, y: y }, thickness: 1 });
          y -= 14; page.drawText(label, { x: margin, y: y, size: 10, font }); y -= 20;
        };
        line('Testator Signature');
        line('Witness 1 Signature / Name / Address');
        line('Witness 2 Signature / Name / Address');
        // Add page numbers
        const pages = willPdf.getPages();
        const total = pages.length;
        pages.forEach((p, i) => {
          const txt = `Page ${i+1} of ${total}`;
          p.drawText(txt, { x: p.getSize().width - 120, y: 20, size: 10, font, color: rgb(0.2,0.2,0.2) });
        });

        const willPdfBytes = await willPdf.save();
        const willPdfFile = `will_${userId}_${stamp}.pdf`;
        const willPdfPath = path.join(willsDir, willPdfFile);
        await fs.writeFile(willPdfPath, willPdfBytes);

        // Signing Cover Sheet PDF
        const cover = await PDFDocument.create();
        const cfont = await cover.embedFont(StandardFonts.TimesRomanBold);
        const cpage = cover.addPage();
        const csz = cpage.getSize();
        const draw = (y: number, text: string, size = 12, bold = false) => {
          cpage.drawText(text, { x: 50, y, size, font: bold ? cfont : font, color: rgb(0, 0, 0) });
        };
        let cy = csz.height - 60;
        draw(cy, 'WILL SIGNING CHECKLIST', 16, true); cy -= 24;
        draw(cy, `Testator: ${testatorName}`); cy -= 16;
        draw(cy, `State: ${state}`); cy -= 16;
        draw(cy, `Witnesses required: 2 (typical)`, 12); cy -= 20;
        const steps = [
          '1. Print the Will (PDF) and the Self‑Proving Affidavit (if applicable).',
          '2. Arrange two adult witnesses (not beneficiaries if possible).',
          '3. In the presence of both witnesses, sign and date the Will where indicated.',
          '4. Have each witness sign and print their name and address.',
          '5. If completing a self‑proving affidavit, sign before a notary with both witnesses.',
          '6. Store the original Will securely; share its location with your Executor.',
          '7. Upload a PDF copy of the executed Will in the app (Checklist → Will → Upload).',
        ];
        steps.forEach((t) => { draw(cy, t); cy -= 16; });
        cy -= 8;
        draw(cy, 'This checklist is informational and not legal advice.', 10); cy -= 14;
        const coverBytes = await cover.save();
        const coverFile = `coversheet_${userId}_${stamp}.pdf`;
        const coverPath = path.join(willsDir, coverFile);
        await fs.writeFile(coverPath, coverBytes);

        // Affidavit PDF
        const affPdf = await PDFDocument.create();
        const aPage = affPdf.addPage();
        const sz = aPage.getSize();
        const writeLines = (yStart: number, lines: string[], size = 11, leading = 14) => {
          let y = yStart;
          lines.forEach((line) => {
            aPage.drawText(line, { x: 50, y, size, font, color: rgb(0, 0, 0) });
            y -= leading;
          });
        };
        writeLines(sz.height - 60, [
          'SELF-PROVING AFFIDAVIT',
          `STATE: ${state}  COUNTY: __________`,
          `${testatorName} signed the attached Will in our presence; each witness signed in the presence of the Testator and each other.`,
          '',
          '______________________________  Testator',
          'Witness 1: ____________________________   Address: ____________________________',
          'Witness 2: ____________________________   Address: ____________________________',
          '',
          'Subscribed and sworn before me on ____________ by the Testator and witnesses above.',
          '______________________________  Notary Public   My Commission Expires: ____________'
        ], 12, 16);
        const affPdfBytes = await affPdf.save();
        const affPdfFile = `affidavit_${userId}_${stamp}.pdf`;
        const affPdfPath = path.join(willsDir, affPdfFile);
        await fs.writeFile(affPdfPath, affPdfBytes);

        return res.json({
          documentId: created.id,
          willDocxUrl: `/uploads/wills/${willFile}`,
          affidavitDocxUrl: `/uploads/wills/${affFile}`,
          willPdfUrl: `/uploads/wills/${willPdfFile}`,
          affidavitPdfUrl: `/uploads/wills/${affPdfFile}`,
          coverSheetPdfUrl: `/uploads/wills/${coverFile}`,
          note: 'Print and sign with witnesses per your state. Affidavit may require a notary. This is not legal advice.'
        });
      } catch {
        // Fallback: return DOCX only
        return res.json({
          documentId: created.id,
          willDocxUrl: `/uploads/wills/${willFile}`,
          affidavitDocxUrl: `/uploads/wills/${affFile}`,
          note: 'Print and sign with witnesses per your state. Affidavit may require a notary. This is not legal advice.'
        });
      }
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/estate-documents/upload", (req, res, next) => {
    uploadEstateDoc.single('document')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
          }
          return res.status(400).json({ error: `Upload error: ${err.message}` });
        } else {
          return res.status(400).json({ error: err.message || 'Invalid file upload' });
        }
      }
      
      // Continue with the regular handler
      try {
        if (!req.isAuthenticated()) return res.sendStatus(401);
        
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const fs = await import('fs/promises');
        const path = await import('path');
        const uploadsDir = path.join(process.cwd(), 'uploads', 'estate-documents');
        await fs.mkdir(uploadsDir, { recursive: true });
        const stamp = Date.now();
        const safeName = String(req.file.originalname || 'document.pdf').replace(/[^A-Za-z0-9._-]/g, '_');
        const fileName = `${stamp}_${safeName}`;
        const filePath = path.join(uploadsDir, fileName);
        await fs.writeFile(filePath, req.file.buffer);

        const url = `/uploads/estate-documents/${fileName}`;
        const documentType = String(req.body.documentType || 'will');
        const docId = req.body.documentId ? parseInt(String(req.body.documentId)) : undefined;
        const notarized = String(req.body.notarized || 'false').toLowerCase() === 'true';
        const witnessesJson = req.body.witnesses ? JSON.parse(String(req.body.witnesses)) : undefined;
        const executionDate = req.body.executionDate ? new Date(String(req.body.executionDate)) : new Date();

        let updated: any = null;
        if (docId && Number.isFinite(docId)) {
          updated = await storage.updateEstateDocument(req.user!.id, docId, {
            status: 'executed',
            documentUrl: url,
            executionDate,
            notarized,
            witnesses: witnessesJson,
          } as any);
        } else {
          const plan = await storage.getEstatePlan(req.user!.id);
          updated = await storage.createEstateDocument(req.user!.id, {
            estatePlanId: plan?.id,
            documentType,
            documentName: documentType === 'will' ? 'Last Will and Testament (Signed)' : 'Estate Document (Signed)',
            status: 'executed',
            executionDate,
            notarized,
            witnesses: witnessesJson,
            documentUrl: url,
          } as any);
        }

        return res.json({ document: updated, documentUrl: url });
      } catch (error) {
        console.error('Estate document upload error:', error);
        // Send JSON error response instead of using next()
        res.status(500).json({ 
          error: 'Failed to parse document', 
          message: (error as Error).message 
        });
      }
    });
  });

  // Estate Beneficiaries
  app.get("/api/estate-beneficiaries", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const estatePlanId = req.query.estatePlanId ? parseInt(req.query.estatePlanId as string) : undefined;
      const beneficiaries = await storage.getEstateBeneficiaries(req.user!.id, estatePlanId);
      res.json(beneficiaries);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/estate-beneficiaries", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const beneficiary = await storage.createEstateBeneficiary(req.user!.id, req.body);
      res.json(beneficiary);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/estate-beneficiaries/:beneficiaryId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const beneficiaryId = parseInt(req.params.beneficiaryId);
      const beneficiary = await storage.updateEstateBeneficiary(req.user!.id, beneficiaryId, req.body);
      res.json(beneficiary);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/estate-beneficiaries/:beneficiaryId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const beneficiaryId = parseInt(req.params.beneficiaryId);
      await storage.deleteEstateBeneficiary(req.user!.id, beneficiaryId);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Estate Trusts
  app.get("/api/estate-trusts", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const estatePlanId = req.query.estatePlanId ? parseInt(req.query.estatePlanId as string) : undefined;
      const trusts = await storage.getEstateTrusts(req.user!.id, estatePlanId);
      res.json(trusts);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/estate-trusts", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const trust = await storage.createEstateTrust(req.user!.id, req.body);
      res.json(trust);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/estate-trusts/:trustId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const trustId = parseInt(req.params.trustId);
      const trust = await storage.updateEstateTrust(req.user!.id, trustId, req.body);
      res.json(trust);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/estate-trusts/:trustId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const trustId = parseInt(req.params.trustId);
      await storage.deleteEstateTrust(req.user!.id, trustId);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Estate Scenarios
  app.get("/api/estate-scenarios", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const estatePlanId = req.query.estatePlanId ? parseInt(req.query.estatePlanId as string) : undefined;
      const scenarios = await storage.getEstateScenarios(req.user!.id, estatePlanId);
      res.json(scenarios);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/estate-scenarios", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const scenario = await storage.createEstateScenario(req.user!.id, req.body);
      res.json(scenario);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/estate-scenarios/:scenarioId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const scenarioId = parseInt(req.params.scenarioId);
      const scenario = await storage.updateEstateScenario(req.user!.id, scenarioId, req.body);
      res.json(scenario);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/estate-scenarios/:scenarioId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const scenarioId = parseInt(req.params.scenarioId);
      await storage.deleteEstateScenario(req.user!.id, scenarioId);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Get calculated estate tax scenarios
  app.get("/api/estate-scenarios/calculated-scenarios", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const profile = await storage.getFinancialProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ error: 'Financial profile not found' });
      }

      // Create estate profile from financial profile
      const estateProfile = {
        id: profile.id.toString(),
        userId: profile.userId.toString(),
        totalAssets: calculateTotalAssets(profile),
        totalLiabilities: calculateTotalLiabilities(profile),
        netWorth: calculateNetWorth(profile),
        spouseDetails: profile.maritalStatus === 'married' ? {
          firstName: profile.spouseName?.split(' ')[0],
          lastName: profile.spouseName?.split(' ')[1],
          dateOfBirth: profile.spouseDateOfBirth || undefined
        } : undefined,
        maritalStatus: profile.maritalStatus || 'single',
        state: profile.state || 'CA'
      };

      // Create calculator and run scenarios
      const { EstateTaxScenarioCalculator, createCalculatorFromProfile } = await import('./services/estate-scenario-calculator');
      const calculator = createCalculatorFromProfile(estateProfile);
      const scenarios = calculator.runAllScenarios();

      res.json({ scenarios });
    } catch (error) {
      console.error('Error calculating scenarios:', error);
      next(error);
    }
  });

  // Education Funding Routes
  app.get("/api/education/goals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goals = await storage.getEducationGoals(req.user!.id);
      
      // Get Plaid 529 accounts if available
      const plaid529Accounts = await PlaidDataAggregator.get529Accounts(req.user!.id);
      
      // Calculate projections for each goal and reconstruct funding sources
      const goalsWithProjections = await Promise.all(
        goals.map(async (goal) => {
          const projection = await calculateEducationProjection(goal, req.user!.id);

          // Use stored funding sources if available, otherwise reconstruct from legacy fields
          const fundingSources = goal.fundingSources || [];

          // For backward compatibility, add scholarships and loans if not in fundingSources
          if (fundingSources.length === 0) {
            if (goal.scholarshipPerYear && Number(goal.scholarshipPerYear) > 0) {
              fundingSources.push({
                type: 'scholarships',
                amount: Number(goal.scholarshipPerYear)
              });
            }
            if (goal.loanPerYear && Number(goal.loanPerYear) > 0) {
              fundingSources.push({
                type: 'student_loan',
                amount: Number(goal.loanPerYear)
              });
            }
          }

          let savedOptimization: any = null;
          try {
            const scenarios = await storage.getEducationScenariosByGoal(req.user!.id, goal.id);
            const savedScenario = scenarios
              .slice()
              .reverse()
              .find((scenario) => scenario.scenarioType === 'optimization_engine_saved');

            if (savedScenario) {
              savedOptimization = {
                savedAt: savedScenario.createdAt,
                variables: savedScenario.parameters,
                result: savedScenario.results,
              };
            }
          } catch (scenarioError) {
            if (!isMissingEducationScenarioTable(scenarioError)) {
              throw scenarioError;
            }
          }

          // Fallback: if scenarios table is missing or no saved scenario found,
          // synthesize savedOptimization from cached projectionData summary if present.
          if (!savedOptimization) {
            const summary = (goal as any)?.projectionData?.savedOptimizationSummary;
            if (summary && (summary.optimizedProbabilityOfSuccess != null)) {
              savedOptimization = {
                savedAt: summary.savedAt ?? null,
                variables: null,
                result: {
                  baselineProbabilityOfSuccess: summary.baselineProbabilityOfSuccess ?? null,
                  optimizedProbabilityOfSuccess: summary.optimizedProbabilityOfSuccess ?? null,
                },
              };
            }
          }

          return { ...goal, projection, fundingSources, savedOptimization };
        })
      );
      
      // Include Plaid 529 account data in response
      const response = {
        goals: goalsWithProjections,
        plaid529Accounts: plaid529Accounts.map(acc => ({
          accountId: acc.plaidAccountId,
          accountName: acc.accountName,
          balance: acc.current || 0,
          institutionName: acc.institutionName
        }))
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/education/goals/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const goal = await storage.getEducationGoal(req.user!.id, goalId);
      
      if (!goal) {
        return res.status(404).json({ error: "Education goal not found" });
      }
      
      const projection = await calculateEducationProjection(goal, req.user!.id);
      
      // Use stored funding sources if available, otherwise reconstruct from legacy fields
      const fundingSources = goal.fundingSources || [];
      
      // For backward compatibility, add scholarships and loans if not in fundingSources
      if (fundingSources.length === 0) {
        if (goal.scholarshipPerYear && Number(goal.scholarshipPerYear) > 0) {
          fundingSources.push({
            type: 'scholarships',
            amount: Number(goal.scholarshipPerYear)
          });
        }
        if (goal.loanPerYear && Number(goal.loanPerYear) > 0) {
          fundingSources.push({
            type: 'student_loan',
            amount: Number(goal.loanPerYear)
          });
        }
      }
      
      // Attach savedOptimization if available, or synthesize from projectionData summary
      let savedOptimization: any = null;
      try {
        const scenarios = await storage.getEducationScenariosByGoal(req.user!.id, goalId);
        const savedScenario = scenarios
          .slice()
          .reverse()
          .find((scenario) => scenario.scenarioType === 'optimization_engine_saved');
        if (savedScenario) {
          savedOptimization = {
            savedAt: savedScenario.createdAt,
            variables: savedScenario.parameters,
            result: savedScenario.results,
          };
        }
      } catch (scenarioError) {
        if (!isMissingEducationScenarioTable(scenarioError)) {
          throw scenarioError;
        }
      }
      if (!savedOptimization) {
        const summary = (goal as any)?.projectionData?.savedOptimizationSummary;
        if (summary && (summary.optimizedProbabilityOfSuccess != null)) {
          savedOptimization = {
            savedAt: summary.savedAt ?? null,
            variables: null,
            result: {
              baselineProbabilityOfSuccess: summary.baselineProbabilityOfSuccess ?? null,
              optimizedProbabilityOfSuccess: summary.optimizedProbabilityOfSuccess ?? null,
            },
          };
        }
      }

      res.json({ ...goal, projection, fundingSources, savedOptimization });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/education/goals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      // Get Plaid 529 accounts to enhance initial values
      const plaid529Accounts = await PlaidDataAggregator.get529Accounts(req.user!.id);
      
      // Process funding sources to aggregate monthly contributions
      const fundingSources = req.body.fundingSources || [];
      let baseMonthlyContribution = parseFloat(req.body.monthlyContribution || '0');
      
      // If we have Plaid 529 accounts, suggest using their balance
      if (plaid529Accounts.length > 0) {
        const total529Balance = plaid529Accounts.reduce((sum, account) => sum + (account.current || 0), 0);
        if (total529Balance > 0 && !req.body.currentSavings) {
          req.body.currentSavings = total529Balance;
        }
        
        // Detect monthly contributions from Plaid
        const detected529Contributions = await PlaidDataAggregator.detect529Contributions(req.user!.id);
        if (detected529Contributions > 0 && !req.body.monthlyContribution) {
          baseMonthlyContribution = detected529Contributions;
        }
      }
      
      // Add other monthly funding sources to the base contribution
      const additionalMonthly = fundingSources
        .filter((source: any) => ['529', 'coverdell', 'custodial', 'savings', 'investment', 'other'].includes(source.type))
        .reduce((sum: number, source: any) => sum + (source.amount || 0) / 12, 0);
      
      // Extract scholarships and loans
      const scholarshipPerYear = fundingSources
        .filter((source: any) => source.type === 'scholarships')
        .reduce((sum: number, source: any) => sum + (source.amount || 0), 0);
      
      const loanPerYear = fundingSources
        .filter((source: any) => source.type === 'student_loan')
        .reduce((sum: number, source: any) => sum + (source.amount || 0), 0);
      
      // Create goal with aggregated values
      const goalData = {
        ...req.body,
        monthlyContribution: baseMonthlyContribution + additionalMonthly,
        scholarshipPerYear: scholarshipPerYear || req.body.scholarshipPerYear || 0,
        loanPerYear: loanPerYear || req.body.loanPerYear || 0,
        fundingSources: fundingSources // Store the original funding sources
      };
      
      const goal = await storage.createEducationGoal(req.user!.id, goalData);
      const projection = await calculateEducationProjection(goal, req.user!.id);
      
      // Persist baseline projection and key summary fields for fast retrieval
      const goalWithProjection = await storage.updateEducationGoal(req.user!.id, goal.id, {
        projection,
        projectionData: projection,
        probabilityOfSuccess: projection.probabilityOfSuccess,
        fundingPercentage: projection.fundingPercentage,
        monthlyContributionNeeded: projection.monthlyContributionNeeded,
        lastCalculatedAt: new Date() as any,
      } as any);
      
      res.json({ ...goalWithProjection, projection, fundingSources });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/education/goals/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      
      // Get Plaid 529 accounts for potential updates
      const plaid529Accounts = await PlaidDataAggregator.get529Accounts(req.user!.id);
      
      // Process funding sources to aggregate monthly contributions
      const fundingSources = req.body.fundingSources || [];
      let baseMonthlyContribution = parseFloat(req.body.monthlyContribution || '0');
      
      // Optionally update with latest Plaid 529 data
      if (plaid529Accounts.length > 0 && req.body.syncWithPlaid) {
        const total529Balance = plaid529Accounts.reduce((sum, account) => sum + (account.current || 0), 0);
        if (total529Balance > parseFloat(req.body.currentSavings || '0')) {
          req.body.currentSavings = total529Balance;
        }
        
        const detected529Contributions = await PlaidDataAggregator.detect529Contributions(req.user!.id);
        if (detected529Contributions > baseMonthlyContribution) {
          baseMonthlyContribution = detected529Contributions;
        }
      }
      
      // Add other monthly funding sources to the base contribution
      const additionalMonthly = fundingSources
        .filter((source: any) => ['529', 'coverdell', 'custodial', 'savings', 'investment', 'other'].includes(source.type))
        .reduce((sum: number, source: any) => sum + (source.amount || 0) / 12, 0);
      
      // Extract scholarships and loans
      const scholarshipPerYear = fundingSources
        .filter((source: any) => source.type === 'scholarships')
        .reduce((sum: number, source: any) => sum + (source.amount || 0), 0);
      
      const loanPerYear = fundingSources
        .filter((source: any) => source.type === 'student_loan')
        .reduce((sum: number, source: any) => sum + (source.amount || 0), 0);
      
      // Update goal with aggregated values
      const goalData = {
        ...req.body,
        monthlyContribution: baseMonthlyContribution + additionalMonthly,
        scholarshipPerYear: scholarshipPerYear || req.body.scholarshipPerYear || 0,
        loanPerYear: loanPerYear || req.body.loanPerYear || 0,
        fundingSources: fundingSources // Store the original funding sources
      };
      
      const goal = await storage.updateEducationGoal(req.user!.id, goalId, goalData);
      const projection = await calculateEducationProjection(goal, req.user!.id);
      
      // Persist latest projection and summary fields on update as well
      const updatedWithProjection = await storage.updateEducationGoal(req.user!.id, goalId, {
        projection,
        projectionData: projection,
        probabilityOfSuccess: projection.probabilityOfSuccess,
        fundingPercentage: projection.fundingPercentage,
        monthlyContributionNeeded: projection.monthlyContributionNeeded,
        lastCalculatedAt: new Date() as any,
      } as any);
      
      res.json({ ...updatedWithProjection, projection, fundingSources });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/education/goals/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      await storage.deleteEducationGoal(req.user!.id, goalId);
      
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Life Goals Routes
  app.get("/api/life-goals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goals = await storage.getLifeGoals(req.user!.id);
      res.json(goals);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/life-goals/:id", validateIdParam, async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const goal = await storage.getLifeGoal(req.user!.id, goalId);
      
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      
      res.json(goal);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/life-goals", validateLifeGoalCreate, async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      // Additional business logic validation
      const validation = await validateLifeGoalBusinessLogic(req.body, req.user!.id);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validation failed', details: validation.errors });
      }
      
      const goal = await storage.createLifeGoal(req.user!.id, req.body);
      res.json(goal);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/life-goals/:id", validateIdParam, validateLifeGoalUpdate, async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      // Additional business logic validation
      const validation = await validateLifeGoalBusinessLogic(req.body, req.user!.id);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validation failed', details: validation.errors });
      }
      
      const goalId = parseInt(req.params.id);
      const goal = await storage.updateLifeGoal(req.user!.id, goalId, req.body);
      res.json(goal);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/life-goals/:id", validateIdParam, async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      await storage.deleteLifeGoal(req.user!.id, goalId);
      
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // College cost lookup
  app.get("/api/education/cost", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { collegeId, year } = req.query;
      
      if (!collegeId || !year) {
        return res.status(400).json({ error: "collegeId and year are required" });
      }
      
      const college = await storage.getCollegeById(collegeId as string);
      if (!college) {
        return res.status(404).json({ error: "College not found" });
      }
      
      // Apply inflation to project future cost
      const currentYear = new Date().getFullYear();
      const targetYear = parseInt(year as string);
      const yearsToInflate = targetYear - currentYear;
      const inflationRate = 0.05; // 5% college cost inflation
      
      const projectedCost = {
        inStateTuition: parseFloat(college.inStateTuition?.toString() || '0') * Math.pow(1 + inflationRate, yearsToInflate),
        outOfStateTuition: parseFloat(college.outOfStateTuition?.toString() || '0') * Math.pow(1 + inflationRate, yearsToInflate),
        roomAndBoard: parseFloat(college.roomAndBoard?.toString() || '0') * Math.pow(1 + inflationRate, yearsToInflate),
        totalInState: 0,
        totalOutOfState: 0
      };
      
      projectedCost.totalInState = projectedCost.inStateTuition + projectedCost.roomAndBoard;
      projectedCost.totalOutOfState = projectedCost.outOfStateTuition + projectedCost.roomAndBoard;
      
      res.json({ college, projectedCost });
    } catch (error) {
      next(error);
    }
  });

  // State 529 plan info
  app.get("/api/education/state-info", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { state } = req.query;
      
      if (!state) {
        return res.status(400).json({ error: "state parameter is required" });
      }
      
      const planInfo = await storage.getState529Plan(state as string);
      res.json(planInfo || { message: "No specific 529 plan information available for this state" });
    } catch (error) {
      next(error);
    }
  });

  // College search using College Scorecard API
  app.get("/api/education/college-search", async (req, res, next) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.status(400).json({ error: "Query must be at least 2 characters long" });
      }
      
      // Use environment variable for API key
      const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY;
      
      if (!API_KEY) {
        console.error('College Scorecard API key not configured');
        return res.status(500).json({ 
          error: "College search is not configured. Please add COLLEGE_SCORECARD_API_KEY to environment variables." 
        });
      }
      
      const response = await fetch(
        `https://api.data.gov/ed/collegescorecard/v1/schools?api_key=${API_KEY}&school.name=${encodeURIComponent(query)}&fields=id,school.name,school.city,school.state,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state,latest.cost.roomboard.oncampus,school.ownership&per_page=10`
      );
      
      if (!response.ok) {
        throw new Error(`College Scorecard API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      const results = data.results.map((school: any) => ({
        id: school.id,
        name: school['school.name'],
        city: school['school.city'],
        state: school['school.state'],
        inStateTuition: school['latest.cost.tuition.in_state'],
        outOfStateTuition: school['latest.cost.tuition.out_of_state'],
        roomAndBoard: school['latest.cost.roomboard.oncampus'],
        isPublic: school['school.ownership'] === 1 // 1 = Public
      }));
      
      res.json(results);
    } catch (error) {
      console.error('Error searching colleges:', error);
      next(error);
    }
  });

  // Education recommendations powered by Gemini
  app.post("/api/education/recommendations", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { goalId, allGoals } = req.body;
      
      if (!goalId && !allGoals) {
        return res.status(400).json({ error: "Either goalId or allGoals must be provided" });
      }
      
      const profile = await storage.getFinancialProfile(req.user!.id);
      let recommendations: string;
      
      if (allGoals) {
        // Get recommendations for all goals
        const goals = await storage.getEducationGoals(req.user!.id);
        const goalsWithProjections = await Promise.all(
          goals.map(async (goal) => {
            const projection = await calculateEducationProjection(goal, req.user!.id);
            return { ...goal, projection };
          })
        );
        recommendations = await generateAllGoalsRecommendations(goalsWithProjections, profile);
      } else {
        // Get recommendations for specific goal
        const goal = await storage.getEducationGoal(req.user!.id, goalId);
        if (!goal) {
          return res.status(404).json({ error: "Education goal not found" });
        }
        
        const projection = await calculateEducationProjection(goal, req.user!.id);
        recommendations = await generateEducationRecommendations(goal, projection, profile);
      }
      
      res.json({ recommendationText: recommendations });
    } catch (error) {
      next(error);
    }
  });

  // Get structured education recommendations for display
  app.get("/api/education/structured-recommendations", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goals = await storage.getEducationGoals(req.user!.id);
      if (!goals || goals.length === 0) {
        return res.json({ recommendations: [] });
      }
      
      const profile = await storage.getFinancialProfile(req.user!.id);
      
      // Calculate projections for all goals
      const goalsWithProjections = await Promise.all(
        goals.map(async (goal) => {
          const projection = await calculateEducationProjection(goal, req.user!.id);
          return { ...goal, projection };
        })
      );
      
      // Generate structured recommendations
      const recommendations = await generateStructuredEducationRecommendations(goalsWithProjections, profile);
      
      res.json({ recommendations });
    } catch (error) {
      next(error);
    }
  });

  // Get personalized recommendations for a specific education goal (permissive even if scenarios table is missing)
  app.get("/api/education/goal-recommendations/:goalId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { goalId } = req.params;
      const goalIdNumber = Number(goalId);
      if (!Number.isFinite(goalIdNumber)) {
        return res.status(400).json({ error: "goalId must be numeric" });
      }
      const userId = req.user!.id;

      const goal = await storage.getEducationGoal(userId, goalIdNumber);
      if (!goal) {
        return res.status(404).json({ error: "Education goal not found" });
      }

      // Load saved optimization scenario if table exists; proceed if missing
      let savedScenario: any | null = null;
      try {
        const scenarios = await storage.getEducationScenariosByGoal(userId, goalIdNumber);
        savedScenario = scenarios.find((s) => s.scenarioType === "optimization_engine_saved") ?? null;
      } catch (scenarioError) {
        if (!isMissingEducationScenarioTable(scenarioError)) throw scenarioError;
        console.warn("[Education] education_scenarios table missing; proceeding with goal/projection for insights");
      }

      const profile = await storage.getFinancialProfile(userId);
      const projection = await calculateEducationProjection(goal, userId);
      const goalWithProjection = { ...goal, projection };

      // Cache by goal + key dependencies so we persist and can show timestamp
      const { widgetCacheManager } = await import("./widget-cache-manager");
      const refresh = req.query.refresh === "true";
      const cachedOnly = req.query.cachedOnly === "true";
      const dependencies = {
        goalId: goalIdNumber,
        goalUpdatedAt: goal.updatedAt,
        projectionSummary: {
          totalCost: projection.totalCost,
          totalFunded: projection.totalFunded,
          fundingPercentage: projection.fundingPercentage,
          probabilityOfSuccess: projection.probabilityOfSuccess,
          monthlyContributionNeeded: projection.monthlyContributionNeeded,
        },
        variables: savedScenario?.parameters || null,
        monthlyContribution: goal.monthlyContribution,
        scholarshipPerYear: goal.scholarshipPerYear,
        loanPerYear: goal.loanPerYear,
        profileLastUpdated: profile?.lastUpdated,
      };
      const inputHash = widgetCacheManager.generateInputHash("education_goal_insights", dependencies);

      const cached = await widgetCacheManager.getCachedWidget(userId, "education_goal_insights", inputHash);
      if (cached?.data) {
        const payload = {
          recommendations: cached.data.recommendations || [],
          lastGeneratedAt: cached.calculatedAt,
          cached: true,
        };
        if (cachedOnly || !refresh) {
          return res.json(payload);
        }
      } else if (cachedOnly) {
        return res.sendStatus(204);
      }

      const recommendations = await generatePersonalizedGoalRecommendations(goalWithProjection, profile, savedScenario || undefined);
      await widgetCacheManager.cacheWidget(userId, "education_goal_insights", inputHash, { recommendations }, 24);
      return res.json({
        recommendations,
        lastGeneratedAt: new Date().toISOString(),
        cached: false,
      });
    } catch (error) {
      next(error);
    }
  });

  // Get Plaid 529 accounts for education funding
  app.get("/api/education/plaid-529-accounts", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      // Get 529 accounts from Plaid
      const plaid529Accounts = await PlaidDataAggregator.get529Accounts(req.user!.id);
      
      // Detect monthly contributions
      const monthlyContributions = await PlaidDataAggregator.detect529Contributions(req.user!.id);
      
      // Calculate total balance
      const totalBalance = plaid529Accounts.reduce((sum, account) => sum + (account.current || 0), 0);
      
      res.json({
        accounts: plaid529Accounts.map(acc => ({
          accountId: acc.plaidAccountId,
          accountName: acc.accountName,
          institutionName: acc.institutionName,
          balance: acc.current || 0,
          accountType: acc.accountType,
          subtype: acc.accountSubtype
        })),
        totalBalance,
        detectedMonthlyContribution: monthlyContributions
      });
    } catch (error) {
      next(error);
    }
  });

  // Sync specific education goal with Plaid 529 accounts
  app.post("/api/education/goals/:id/sync-plaid", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const goal = await storage.getEducationGoal(req.user!.id, goalId);
      
      if (!goal) {
        return res.status(404).json({ error: "Education goal not found" });
      }
      
      // Get Plaid 529 account data
      const plaid529Accounts = await PlaidDataAggregator.get529Accounts(req.user!.id);
      
      if (plaid529Accounts.length === 0) {
        return res.json({ 
          message: "No 529 accounts found in Plaid", 
          updated: false 
        });
      }
      
      // Calculate total 529 balance
      const total529Balance = plaid529Accounts.reduce((sum, account) => sum + (account.current || 0), 0);
      
      // Detect monthly contributions
      const detected529Contributions = await PlaidDataAggregator.detect529Contributions(req.user!.id);
      
      // Update goal with Plaid data
      const updates: any = {};
      
      if (total529Balance > parseFloat(goal.currentSavings?.toString() || '0')) {
        updates.currentSavings = total529Balance;
      }
      
      if (detected529Contributions > parseFloat(goal.monthlyContribution?.toString() || '0')) {
        updates.monthlyContribution = detected529Contributions;
      }
      
      if (Object.keys(updates).length > 0) {
        const updatedGoal = await storage.updateEducationGoal(req.user!.id, goalId, updates);
        const projection = await calculateEducationProjection(updatedGoal, req.user!.id);
        
        res.json({
          message: "Education goal synced with Plaid 529 accounts",
          updated: true,
          goal: { ...updatedGoal, projection },
          plaidData: {
            accounts: plaid529Accounts.length,
            totalBalance: total529Balance,
            monthlyContribution: detected529Contributions
          }
        });
      } else {
        res.json({
          message: "No updates needed - manual values are higher",
          updated: false,
          plaidData: {
            accounts: plaid529Accounts.length,
            totalBalance: total529Balance,
            monthlyContribution: detected529Contributions
          }
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // Education optimization endpoint
  app.post("/api/education/optimize", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { goalId, constraints, overrides, targetSuccessRate } = req.body || {};
      if (goalId == null) {
        return res.status(400).json({ error: "goalId is required" });
      }

      const goalIdNumber = Number(goalId);
      if (!Number.isFinite(goalIdNumber)) {
        return res.status(400).json({ error: "goalId must be numeric" });
      }

      const goal = await storage.getEducationGoal(req.user!.id, goalIdNumber);
      if (!goal) {
        return res.status(404).json({ error: "Education goal not found" });
      }

      const profile = await storage.getFinancialProfile(req.user!.id);

      let result: any;
      try {
        const { educationOptimizerPool } = await import('./services/education-optimizer-pool');
        result = await educationOptimizerPool.run({
          type: 'education-optimize',
          payload: {
            goal,
            profile,
            constraints,
            overrides,
            targetSuccessRate,
          },
        });
      } catch (poolError) {
        console.warn('[Education] Optimizer pool unavailable; falling back to inline execution:', (poolError as any)?.message || poolError);
        result = await optimizeEducationGoal({
          goal,
          profile,
          constraints,
          overrides,
          targetSuccessRate,
        });
      }

      try {
        const existing = await storage.getEducationScenariosByGoal(req.user!.id, goalIdNumber);
        for (const scenario of existing) {
          if (scenario.scenarioType === "optimization_engine") {
            await storage.deleteEducationScenario(req.user!.id, scenario.id);
          }
        }
      } catch (scenarioError) {
        if (!isMissingEducationScenarioTable(scenarioError)) {
          throw scenarioError;
        }
        console.warn('[Education] education_scenarios table missing; skipping optimization history cleanup');
      }

      try {
        await storage.createEducationScenario(req.user!.id, {
          educationGoalId: goalIdNumber,
          scenarioName: "Education Optimization Plan",
          scenarioType: "optimization_engine",
          parameters: result.variables,
          results: result
        });
      } catch (scenarioError) {
        if (!isMissingEducationScenarioTable(scenarioError)) {
          throw scenarioError;
        }
        console.warn('[Education] education_scenarios table missing; skipping optimization persistence');
      }

      return res.json(result);
    } catch (error) {
      console.error('Error optimizing education goal:', error);
      res.status(500).json({ error: "Failed to optimize education goal" });
    }
  });

  // Optimization status endpoint (permissive when scenarios table is missing)
  app.get("/api/education/optimization-status/:goalId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const goalId = Number(req.params.goalId);
      if (!Number.isFinite(goalId)) {
        return res.status(400).json({ error: "goalId must be numeric" });
      }

      const goal = await storage.getEducationGoal(req.user!.id, goalId);
      if (!goal) {
        return res.status(404).json({ error: "Education goal not found" });
      }

      let scenarios: any[] = [];
      let missingScenarioTable = false;
      try {
        scenarios = await storage.getEducationScenariosByGoal(req.user!.id, goalId);
      } catch (scenarioError) {
        if (!isMissingEducationScenarioTable(scenarioError)) {
          throw scenarioError;
        }
        missingScenarioTable = true;
        scenarios = [];
      }

      const savedScenario = scenarios.find((s) => s.scenarioType === "optimization_engine_saved");

      return res.json({
        hasSavedOptimization: !!savedScenario || missingScenarioTable,
        savedAt: savedScenario?.createdAt ?? null,
        savedVariables: savedScenario?.parameters ?? null,
        savedResult: savedScenario?.results ?? null,
        currentProbabilityOfSuccess:
          goal?.projectionData?.probabilityOfSuccess ??
          goal?.probabilityOfSuccess ??
          goal?.projection?.probabilityOfSuccess ??
          null,
      });
    } catch (error) {
      next(error);
    }
  });

  // Persist optimization result and update base goal settings
  app.post("/api/education/optimize/save", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { goalId, optimizerControls, optimizerResult } = req.body || {};
      if (goalId == null || !optimizerResult?.variables) {
        return res.status(400).json({ error: "goalId and optimizer result are required" });
      }

      const goalIdNumber = Number(goalId);
      if (!Number.isFinite(goalIdNumber)) {
        return res.status(400).json({ error: "goalId must be numeric" });
      }

      const goal = await storage.getEducationGoal(req.user!.id, goalIdNumber);
      if (!goal) {
        return res.status(404).json({ error: "Education goal not found" });
      }

      const baselineProjection = await calculateEducationProjection(goal, req.user!.id);

      const mappedStrategy = mapStrategyToRisk(optimizerResult.variables.investmentStrategy);
      const tuitionInflation = typeof optimizerControls?.tuitionInflation === 'number'
        ? optimizerControls.tuitionInflation
        : Number(goal.inflationRate ?? 5);

      const updatedGoal = await storage.updateEducationGoal(req.user!.id, goalIdNumber, {
        // Preserve user's exact entries when provided; fall back to optimized values
        monthlyContribution: (typeof optimizerControls?.maxMonthlyContribution === 'number'
          ? optimizerControls.maxMonthlyContribution
          : optimizerResult.variables.monthlyContribution),
        loanPerYear: (typeof optimizerControls?.maxLoanPerYear === 'number'
          ? optimizerControls.maxLoanPerYear
          : optimizerResult.variables.loanPerYear),
        scholarshipPerYear: (typeof optimizerControls?.annualScholarships === 'number'
          ? optimizerControls.annualScholarships
          : optimizerResult.variables.annualScholarships),
        inflationRate: tuitionInflation,
        riskProfile: mappedStrategy,
        probabilityOfSuccess: optimizerResult.probabilityOfSuccess,
        fundingPercentage: optimizerResult.fundingPercentage,
      });

      const projection = await calculateEducationProjection(updatedGoal, req.user!.id);

      // Persist a lightweight summary inside projectionData so the UI can render
      // optimized vs baseline labels and delta after reloads even if scenarios table is unavailable.
      const savedOptimizationSummary = {
        baselineProbabilityOfSuccess: baselineProjection?.probabilityOfSuccess ?? null,
        optimizedProbabilityOfSuccess: projection?.probabilityOfSuccess ?? null,
        delta: (projection?.probabilityOfSuccess ?? 0) - (baselineProjection?.probabilityOfSuccess ?? 0),
        savedAt: new Date().toISOString(),
        labelsVersion: 1,
      };
      const projectionWithSummary = {
        ...projection,
        savedOptimizationSummary,
      };

      const finalGoal = await storage.updateEducationGoal(req.user!.id, goalIdNumber, {
        projection: projectionWithSummary,
        projectionData: projectionWithSummary,
        probabilityOfSuccess: projection.probabilityOfSuccess,
        fundingPercentage: projection.fundingPercentage,
        monthlyContributionNeeded: projection.monthlyContributionNeeded,
      });

      try {
        await storage.createEducationScenario(req.user!.id, {
          educationGoalId: goalIdNumber,
          scenarioName: "Saved Optimization Plan",
          scenarioType: "optimization_engine_saved",
          parameters: optimizerResult.variables,
          results: {
            ...optimizerResult,
            baselineProbabilityOfSuccess: baselineProjection?.probabilityOfSuccess ?? null,
            optimizedProbabilityOfSuccess: projection?.probabilityOfSuccess ?? null,
            baselineProjection,
            optimizedProjection: projectionWithSummary,
          },
        });
      } catch (scenarioError) {
        if (!isMissingEducationScenarioTable(scenarioError)) {
          throw scenarioError;
        }
        console.warn('[Education] education_scenarios table missing; skipping saved optimization persistence');
      }

      res.json({
        goal: { ...finalGoal, projection: projectionWithSummary },
        optimizerResult: {
          ...optimizerResult,
          baselineProbabilityOfSuccess: baselineProjection?.probabilityOfSuccess ?? null,
          optimizedProbabilityOfSuccess: projection?.probabilityOfSuccess ?? null,
        },
      });
    } catch (error) {
      console.error('Error saving optimization result:', error);
      res.status(500).json({ error: "Failed to save optimization result" });
    }
  });

  // Education scenario calculation endpoint
  app.post("/api/education/calculate-scenario", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { goalId, variables } = req.body;
      
      // Get the education goal
      const goal = await storage.getEducationGoal(req.user!.id, goalId);
      if (!goal) {
        return res.status(404).json({ error: "Education goal not found" });
      }

      // Calculate scenario using provided variables
      const result = await calculateEducationScenario({
        goalId,
        userId: req.user!.id,
        ...variables
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error calculating education scenario:', error);
      res.status(500).json({ error: "Failed to calculate scenario" });
    }
  });

  // Save education what-if scenario endpoint
  app.post("/api/education/save-scenario", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { goalId, variables, result } = req.body;
      
      // Get the education goal to verify it exists
      const goal = await storage.getEducationGoal(req.user!.id, goalId);
      if (!goal) {
        return res.status(404).json({ error: "Education goal not found" });
      }

      // Delete existing scenario for this goal (if any) to keep only the latest
      try {
        const existingScenarios = await storage.getEducationScenariosByGoal(req.user!.id, goalId);
        for (const scenario of existingScenarios) {
          await storage.deleteEducationScenario(req.user!.id, scenario.id);
        }
      } catch (scenarioError) {
        if (!isMissingEducationScenarioTable(scenarioError)) {
          throw scenarioError;
        }
        console.warn('[Education] education_scenarios table missing; skipping scenario cleanup');
      }

      // Save scenario to database
      try {
        const savedScenario = await storage.createEducationScenario(req.user!.id, {
          educationGoalId: goalId,
          scenarioName: "Current What-If Scenario",
          scenarioType: "what_if_analysis",
          parameters: variables,
          results: result
        });
        return res.json({ success: true, message: "Scenario saved successfully", scenario: savedScenario });
      } catch (scenarioError) {
        if (!isMissingEducationScenarioTable(scenarioError)) {
          throw scenarioError;
        }
        console.warn('[Education] education_scenarios table missing; scenario persistence disabled');
        return res.json({ success: false, message: "Scenario persistence temporarily unavailable" });
      }
    } catch (error) {
      console.error('Error saving education scenario:', error);
      res.status(500).json({ error: "Failed to save scenario" });
    }
  });

  // Get saved education what-if scenario endpoint (prefers saved optimization)
  app.get("/api/education/saved-scenario/:goalId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.goalId);
      
      let scenarios: Awaited<ReturnType<typeof storage.getEducationScenariosByGoal>> = [];
      try {
        scenarios = await storage.getEducationScenariosByGoal(req.user!.id, goalId);
      } catch (scenarioError) {
        if (isMissingEducationScenarioTable(scenarioError)) {
          console.warn('[Education] education_scenarios table missing; returning empty scenario list');
          return res.status(404).json({ error: "No saved scenario found" });
        }
        throw scenarioError;
      }
      // Prefer the latest saved optimization scenario if available
      const savedOptimizations = scenarios
        .filter((s: any) => s.scenarioType === 'optimization_engine_saved');
      const latestSavedOpt = savedOptimizations.length > 0 ? savedOptimizations[savedOptimizations.length - 1] : null;

      if (latestSavedOpt) {
        return res.json({
          goalId: latestSavedOpt.educationGoalId,
          variables: latestSavedOpt.parameters,
          result: latestSavedOpt.results,
          savedAt: latestSavedOpt.createdAt
        });
      }

      if (!scenarios || scenarios.length === 0) {
        return res.status(404).json({ error: "No saved scenario found" });
      }
      
      // Return the latest scenario
      const latestScenario = scenarios[scenarios.length - 1];
      res.json({
        goalId: latestScenario.educationGoalId,
        variables: latestScenario.parameters,
        result: latestScenario.results,
        savedAt: latestScenario.createdAt
      });
    } catch (error) {
      console.error('Error retrieving saved education scenario:', error);
      res.status(500).json({ error: "Failed to retrieve saved scenario" });
    }
  });

  // Ownership and beneficiary audit endpoint
  app.get("/api/ownership-beneficiary-audit", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const profile = await storage.getFinancialProfile(req.user!.id);
      if (!profile) {
        return res.json({ assets: [], summary: {} });
      }

      const assets = [];
      
      // Process bank accounts
      if (profile.bankAccounts && Array.isArray(profile.bankAccounts)) {
        for (const account of profile.bankAccounts) {
          const isPOD = account.accountType === 'payable_on_death';
          const hasPrimary = isPOD && account.podBeneficiary && account.podBeneficiary.trim() !== '';
          const hasContingent = isPOD && account.podContingentBeneficiary && account.podContingentBeneficiary.trim() !== '';
          
          assets.push({
            type: 'bank',
            name: account.institutionName || 'Bank Account',
            value: account.balance || 0,
            ownership: account.ownership || 'individual',
            requiresBeneficiary: isPOD,
            hasBeneficiary: hasPrimary,
            hasContingentBeneficiary: hasContingent,
            beneficiary: account.podBeneficiary || null,
            contingentBeneficiary: account.podContingentBeneficiary || null,
            accountOwner: account.accountOwner || 'user',
          });
        }
      }

      // Process investment accounts
      if (profile.investmentAccounts && Array.isArray(profile.investmentAccounts)) {
        for (const account of profile.investmentAccounts) {
          const isTOD = account.accountType === 'tod';
          const hasPrimary = isTOD && account.todBeneficiary && account.todBeneficiary.trim() !== '';
          const hasContingent = isTOD && account.todContingentBeneficiary && account.todContingentBeneficiary.trim() !== '';
          
          assets.push({
            type: 'investment',
            name: account.institutionName || 'Investment Account',
            value: account.balance || 0,
            ownership: account.ownership || 'individual',
            requiresBeneficiary: isTOD,
            hasBeneficiary: hasPrimary,
            hasContingentBeneficiary: hasContingent,
            beneficiary: account.todBeneficiary || null,
            contingentBeneficiary: account.todContingentBeneficiary || null,
            accountOwner: account.accountOwner || 'user',
          });
        }
      }

      // Process retirement accounts - always require beneficiaries
      if (profile.retirementAccounts && Array.isArray(profile.retirementAccounts)) {
        for (const account of profile.retirementAccounts) {
          const hasPrimary = account.beneficiaries && account.beneficiaries.primary && account.beneficiaries.primary.trim() !== '';
          const hasContingent = account.beneficiaries && account.beneficiaries.contingent && account.beneficiaries.contingent.trim() !== '';
          
          assets.push({
            type: 'retirement',
            name: `${account.accountType?.toUpperCase() || 'Retirement'} - ${account.institutionName || 'Unknown'}`,
            value: account.balance || 0,
            ownership: 'individual', // Retirement accounts are always individual
            requiresBeneficiary: true,
            hasBeneficiary: hasPrimary,
            hasContingentBeneficiary: hasContingent,
            beneficiary: account.beneficiaries?.primary || null,
            contingentBeneficiary: account.beneficiaries?.contingent || null,
            accountOwner: account.accountOwner || 'user',
          });
        }
      }

      // Process real estate
      if (profile.primaryResidence) {
        assets.push({
          type: 'real_estate',
          name: 'Primary Residence',
          value: (profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0),
          ownership: profile.primaryResidence.ownership || 'individual',
          requiresBeneficiary: false,
          hasBeneficiary: false,
        });
      }

      // Process life insurance - always requires beneficiaries
      if (profile.lifeInsurance?.hasPolicy) {
        const hasPrimary = profile.lifeInsurance.beneficiaries && 
          profile.lifeInsurance.beneficiaries.primary && 
          profile.lifeInsurance.beneficiaries.primary.trim() !== '';
        const hasContingent = profile.lifeInsurance.beneficiaries && 
          profile.lifeInsurance.beneficiaries.contingent && 
          profile.lifeInsurance.beneficiaries.contingent.trim() !== '';
          
        assets.push({
          type: 'life_insurance',
          name: `Life Insurance - ${profile.lifeInsurance.policyType || 'Unknown Type'}`,
          value: profile.lifeInsurance.coverageAmount || 0,
          ownership: 'individual',
          requiresBeneficiary: true,
          hasBeneficiary: hasPrimary,
          hasContingentBeneficiary: hasContingent,
          beneficiary: profile.lifeInsurance.beneficiaries?.primary || null,
          contingentBeneficiary: profile.lifeInsurance.beneficiaries?.contingent || null,
          policyOwner: profile.lifeInsurance.policyOwner || 'user',
        });
      }

      // Optional filter by testator's first name (for Will Creator step 3)
      const testatorFirstRaw = (req.query.testatorFirst as string | undefined) || undefined;
      let filtered = assets;
      if (testatorFirstRaw && typeof testatorFirstRaw === 'string') {
        const testatorFirst = testatorFirstRaw.trim().toLowerCase();
        const userFirst = String(profile.firstName || '').trim().split(/\s+/)[0].toLowerCase();
        let spouseFirst = '';
        if (profile.spouseName) spouseFirst = String(profile.spouseName).trim().split(/\s+/)[0].toLowerCase();
        const testatorRole = testatorFirst === spouseFirst ? 'spouse' : 'user';
        filtered = assets.filter((a: any) => {
          const ownership = String(a.ownership || '').toLowerCase();
          if (ownership === 'joint') return true;
          const ownerRole = (a.accountOwner || a.policyOwner || '').toString().toLowerCase();
          if (ownerRole === 'user' || ownerRole === 'spouse') return ownerRole === testatorRole;
          // If explicit owner role is missing, fallback to strict individual only when role matches inferred
          return ownership === 'individual' && testatorRole === 'user';
        });
      }

      // Calculate summary statistics
      const summary = {
        totalAssets: filtered.reduce((sum, asset) => sum + asset.value, 0),
        assetsRequiringBeneficiaries: filtered.filter(a => a.requiresBeneficiary).length,
        assetsWithBeneficiaries: filtered.filter(a => a.requiresBeneficiary && a.hasBeneficiary).length,
        assetsMissingBeneficiaries: filtered.filter(a => a.requiresBeneficiary && !a.hasBeneficiary).length,
        probateAssets: filtered.filter(a => a.ownership === 'individual' && !a.requiresBeneficiary).length,
        nonProbateAssets: filtered.filter(a => a.ownership !== 'individual' || a.requiresBeneficiary).length,
      };

      res.json({ assets: filtered, summary });
    } catch (error) {
      console.error('Error fetching ownership data:', error);
      res.status(500).json({ error: 'Failed to fetch ownership data' });
    }
  });

  // Education AI chatbot endpoint
  app.post("/api/education/ai-chat", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { message, educationGoals, chatHistory } = req.body;
      
      // Fetch the complete financial profile from database instead of relying on frontend data
      const completeProfile = await db.query.financialProfiles.findFirst({
        where: eq(financialProfiles.userId, req.user!.id)
      });
      
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
      });

      // Build comprehensive context from complete user data
      const formatCurrency = (amount: any) => amount ? `$${Number(amount).toLocaleString()}` : 'Not provided';
      const formatAssets = (assets: any) => {
        if (!assets || !Array.isArray(assets)) return 'Not provided';
        return assets.map((asset: any) => `${asset.type || 'Unknown'}: ${formatCurrency(asset.value)}`).join(', ');
      };
      const formatLiabilities = (liabilities: any) => {
        if (!liabilities || !Array.isArray(liabilities)) return 'Not provided';
        return liabilities.map((liability: any) => `${liability.type || 'Unknown'}: ${formatCurrency(liability.balance)}`).join(', ');
      };

      const userContext = `
COMPREHENSIVE USER FINANCIAL PROFILE:

=== PERSONAL INFORMATION ===
- Name: ${completeProfile?.firstName || 'Not provided'} ${completeProfile?.lastName || ''}
- Date of Birth: ${completeProfile?.dateOfBirth || 'Not provided'}
- State: ${completeProfile?.state || 'Not provided'}
- Marital Status: ${completeProfile?.maritalStatus || 'Not provided'}
- Number of Dependents: ${completeProfile?.dependents || 'Not provided'}
- Spouse Name: ${completeProfile?.spouseName || 'Not provided'}
- Spouse Date of Birth: ${completeProfile?.spouseDateOfBirth || 'Not provided'}

=== INCOME & EMPLOYMENT ===
- Annual Income: ${formatCurrency(completeProfile?.annualIncome)}
- Monthly Take-Home Income: ${formatCurrency(completeProfile?.takeHomeIncome)}
- Other Income: ${formatCurrency(completeProfile?.otherIncome)}
- Employment Status: ${completeProfile?.employmentStatus || 'Not provided'}
- Tax Withholding Status: ${completeProfile?.taxWithholdingStatus || 'Not provided'}
- Spouse Annual Income: ${formatCurrency(completeProfile?.spouseAnnualIncome)}
- Spouse Take-Home Income: ${formatCurrency(completeProfile?.spouseTakeHomeIncome)}
- Spouse Employment Status: ${completeProfile?.spouseEmploymentStatus || 'Not provided'}
- Current Savings Rate: ${completeProfile?.savingsRate ? `${completeProfile.savingsRate}%` : 'Not provided'}

=== MONTHLY EXPENSES ===
${completeProfile?.monthlyExpenses ? JSON.stringify(completeProfile.monthlyExpenses, null, 2) : 'Not provided'}

=== ASSETS ===
- Total Assets: ${formatAssets(completeProfile?.assets)}
- Primary Residence: ${completeProfile?.primaryResidence ? JSON.stringify(completeProfile.primaryResidence) : 'Not provided'}
- Additional Properties: ${completeProfile?.additionalProperties ? JSON.stringify(completeProfile.additionalProperties) : 'Not provided'}

=== LIABILITIES ===
- Total Liabilities: ${formatLiabilities(completeProfile?.liabilities)}

=== RISK PROFILE & INVESTMENTS ===
- Risk Tolerance: ${completeProfile?.riskTolerance || 'Not provided'}
- Current Asset Allocation: ${completeProfile?.currentAllocation ? JSON.stringify(completeProfile.currentAllocation) : 'Not provided'}
- Risk Questionnaire Answers: ${completeProfile?.riskQuestionnaire ? JSON.stringify(completeProfile.riskQuestionnaire) : 'Not provided'}
- Spouse Risk Profile: ${completeProfile?.spouseRiskQuestions ? JSON.stringify(completeProfile.spouseRiskQuestions) : 'Not provided'}
- Spouse Asset Allocation: ${completeProfile?.spouseAllocation ? JSON.stringify(completeProfile.spouseAllocation) : 'Not provided'}

=== INSURANCE COVERAGE ===
- Life Insurance: ${completeProfile?.lifeInsurance ? JSON.stringify(completeProfile.lifeInsurance) : 'Not provided'}
- Spouse Life Insurance: ${completeProfile?.spouseLifeInsurance ? JSON.stringify(completeProfile.spouseLifeInsurance) : 'Not provided'}
- Health Insurance: ${completeProfile?.healthInsurance ? JSON.stringify(completeProfile.healthInsurance) : 'Not provided'}
- Disability Insurance: ${completeProfile?.disabilityInsurance ? JSON.stringify(completeProfile.disabilityInsurance) : 'Not provided'}
- Spouse Disability Insurance: ${completeProfile?.spouseDisabilityInsurance ? JSON.stringify(completeProfile.spouseDisabilityInsurance) : 'Not provided'}

=== ESTATE PLANNING ===
- Has Will: ${completeProfile?.hasWill ? 'Yes' : 'No'}
- Has Trust: ${completeProfile?.hasTrust ? 'Yes' : 'No'}
- Has Power of Attorney: ${completeProfile?.hasPowerOfAttorney ? 'Yes' : 'No'}
- Has Healthcare Proxy: ${completeProfile?.hasHealthcareProxy ? 'Yes' : 'No'}
- Has Beneficiaries Designated: ${completeProfile?.hasBeneficiaries ? 'Yes' : 'No'}

=== RETIREMENT PLANNING ===
- Desired Retirement Age: ${completeProfile?.retirementAge || 'Not provided'}
- Desired Retirement Income: ${formatCurrency(completeProfile?.retirementIncome)}
- Life Expectancy: ${completeProfile?.lifeExpectancy || 'Not provided'}
- Social Security Benefit: ${formatCurrency(completeProfile?.socialSecurityBenefit)}
- Pension Benefit: ${formatCurrency(completeProfile?.pensionBenefit)}
- Has Long-Term Care Insurance: ${completeProfile?.hasLongTermCareInsurance ? 'Yes' : 'No'}
- Legacy Goal: ${formatCurrency(completeProfile?.legacyGoal)}

=== TAX INFORMATION ===
- Last Year AGI: ${formatCurrency(completeProfile?.lastYearAGI)}
- Tax Filing Status: ${completeProfile?.taxFilingStatus || 'Not provided'}
- Deduction Amount: ${formatCurrency(completeProfile?.deductionAmount)}

=== FINANCIAL HEALTH SCORES ===
- Overall Financial Health Score: ${completeProfile?.financialHealthScore || 'Not calculated'}
- Emergency Readiness Score: ${completeProfile?.emergencyReadinessScore || 'Not calculated'}
- Retirement Readiness Score: ${completeProfile?.retirementReadinessScore || 'Not calculated'}
- Cash Flow Score: ${completeProfile?.cashFlowScore || 'Not calculated'}

Education Goals:
${educationGoals?.map((goal: any, index: number) => `
Goal ${index + 1}:
- Student: ${goal.studentName} (${goal.relationship})
- College: ${goal.collegeName || 'Not specified'}
- Start Year: ${goal.startYear}
- Years of Study: ${goal.years}
- Cost Per Year: $${goal.costPerYear}
- Current 529 Savings: $${goal.currentSavings}
- Monthly Contribution: $${goal.monthlyContribution}
- Monthly Contribution Needed: $${goal.monthlyContributionNeeded}
- Funding Percentage: ${goal.fundingPercentage}%
- Probability of Success: ${goal.probabilityOfSuccess}%
- Include Room & Board: ${goal.includeRoomBoard ? 'Yes' : 'No'}
- Inflation Rate: ${goal.inflationRate}%
- Expected Return: ${goal.expectedReturn}%
`).join('') || 'No education goals set'}

Chat History:
${chatHistory?.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n') || 'No previous messages'}
`;

      const prompt = `You are Affluvia AI, an expert financial advisor specializing in education funding and 529 college savings plans. You have access to the user's complete comprehensive financial profile from their intake form, including income, expenses, assets, liabilities, insurance, and all education goals data.

${userContext}

Current User Question: "${message}"

IMPORTANT: When providing advice, always reference and use the ACTUAL data from their comprehensive financial profile above. For example:
- Use their actual take-home income (${formatCurrency(completeProfile?.takeHomeIncome)})
- Consider their actual state (${completeProfile?.state}) for 529 tax benefits
- Factor in their actual expenses and savings capacity
- Reference their actual risk tolerance and current allocations
- Consider their family situation (marital status, dependents, spouse income)

Please provide a helpful, personalized response based on the user's actual financial situation and education goals. Focus on:

1. **Actionable Advice**: Give specific, concrete recommendations using their actual financial data
2. **Personalized Analysis**: Reference their actual numbers from the comprehensive profile
3. **Education-Focused**: Concentrate on education funding strategies, 529 plans, and college savings
4. **Tax Optimization**: Provide state-specific 529 tax benefits and education tax strategies
5. **Professional Tone**: Sound like a knowledgeable financial advisor who knows their complete situation
6. **Practical Steps**: Provide clear next steps they can take based on their actual financial capacity

Areas of expertise to leverage when relevant:
- 529 plan optimization and state tax benefits
- Education tax credits and deductions
- Financial aid and FAFSA strategies
- Education loan strategies vs. saving strategies
- Asset allocation for education savings
- Multi-child education planning
- Education funding vs. retirement funding trade-offs

If the user asks about topics outside of education funding, gently redirect them back to education planning while being helpful.

Keep responses concise but comprehensive, and always base recommendations on their specific financial situation and goals.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      res.json({ response });
    } catch (error) {
      console.error('Error in AI chat:', error);
      res.status(500).json({ error: 'Failed to generate AI response' });
    }
  });

  // Roth Conversion AI Validation endpoint
  app.post("/api/roth-conversion/validate", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { 
        inputs,
        results,
        financialProfile
      } = req.body;
      
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
      });

      const formatCurrency = (amount: number) => `$${Math.abs(amount).toLocaleString()}`;
      
      const prompt = `You are an expert financial advisor and tax strategist specializing in Roth conversions. 
Analyze the following Roth conversion calculation results and determine if the user should proceed with the conversions.

USER'S FINANCIAL SITUATION:
- Current Age: ${inputs.currentAge}
- Retirement Age: ${inputs.retirementAge}
- Life Expectancy: ${inputs.longevityAge}
- Filing Status: ${inputs.filingStatus}
- Current Annual Income: ${formatCurrency(inputs.currentIncome)}
- Traditional IRA/401k Balance: ${formatCurrency(inputs.traditionalIRA + inputs.traditional401k)}
- Roth IRA Balance: ${formatCurrency(inputs.rothIRA)}
- Taxable Accounts: ${formatCurrency(inputs.taxableAccounts)}
- Monthly Retirement Expenses: ${formatCurrency(inputs.desiredMonthlyExpense)}
- Social Security Benefit (monthly): ${formatCurrency(inputs.socialSecurityBenefit)}
- State Tax Rate: ${(inputs.stateTaxRate * 100).toFixed(1)}%
- Expected Return: ${inputs.expectedReturn}%

CALCULATED RESULTS:
- Lifetime Tax Savings: ${results.lifetimeTaxSavings >= 0 ? formatCurrency(results.lifetimeTaxSavings) : '-' + formatCurrency(Math.abs(results.lifetimeTaxSavings))} ${results.lifetimeTaxSavings >= 0 ? '(savings)' : '(additional cost)'}
- Total Conversions Recommended: ${formatCurrency(results.totalConversions)} over ${results.yearlyConversions.length} years
- Estate Value WITH Conversions: ${formatCurrency(results.estateValue)}
- Tax-Adjusted Estate Value WITH Conversions: ${formatCurrency(results.taxAdjustedEstateValue)}
- Estate Value WITHOUT Conversions: ${formatCurrency(results.estateValueWithoutConversion)}
- Tax-Adjusted Estate Value WITHOUT Conversions: ${formatCurrency(results.taxAdjustedEstateValueWithoutConversion)}
- Estate Tax Savings for Heirs: ${results.estateTaxSavings >= 0 ? formatCurrency(results.estateTaxSavings) : '-' + formatCurrency(Math.abs(results.estateTaxSavings))}

CONVERSION STRATEGY DETAILS:
${results.recommendedStrategy}

First ${Math.min(3, results.yearlyConversions.length)} years of conversions:
${results.yearlyConversions.slice(0, 3).map(conv => 
  `- Year ${conv.year} (Age ${conv.age}): Convert ${formatCurrency(conv.conversionAmount)}, Tax: ${formatCurrency(conv.taxOwed)}`
).join('\n')}

Based on this analysis, provide a clear YES or NO recommendation on whether to proceed with Roth conversions.

Consider:
1. The lifetime tax impact (positive or negative)
2. The estate tax benefits for heirs
3. The user's age and time horizon
4. Current vs. future tax rates
5. The ability to pay conversion taxes
6. Risk of tax law changes
7. Liquidity needs in retirement
8. Medicare IRMAA thresholds
9. Required Minimum Distributions (RMDs)
10. Overall financial goals and legacy planning

Response format:
{
  "recommendation": "YES" or "NO",
  "confidence": "HIGH", "MEDIUM", or "LOW",
  "primaryReason": "One sentence summary of main reason",
  "keyFactors": [
    "Factor 1 supporting the recommendation",
    "Factor 2 supporting the recommendation",
    "Factor 3 supporting the recommendation"
  ],
  "warnings": [
    "Any important warnings or caveats"
  ],
  "alternativeStrategy": "If NO, what alternative strategy might work better"
}`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      // Parse the AI response
      let validationResult;
      try {
        // Extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          validationResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Could not parse AI response");
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // Fallback validation
        validationResult = {
          recommendation: results.lifetimeTaxSavings > 0 ? "YES" : "NO",
          confidence: "LOW",
          primaryReason: "Analysis based on lifetime tax savings",
          keyFactors: [
            results.lifetimeTaxSavings > 0 ? "Positive lifetime tax savings" : "Negative lifetime tax savings",
            results.estateTaxSavings > 0 ? "Estate tax benefits for heirs" : "No estate tax benefits"
          ],
          warnings: ["AI analysis unavailable - using basic calculation"],
          alternativeStrategy: "Consult with a tax professional"
        };
      }

      res.json(validationResult);
    } catch (error) {
      console.error('Error in Roth conversion validation:', error);
      res.status(500).json({ error: 'Failed to validate Roth conversion strategy' });
    }
  });

  // Comprehensive AI Roth Conversion Strategy Analysis endpoint using RothConversionEngine
  app.post("/api/roth-conversion/ai-analysis", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      // Extract strategy from request body (default to 'moderate' if not provided)
      const strategy: ConversionStrategy = req.body.strategy || 'moderate';
      
      // Validate strategy is one of the allowed values
      const allowedStrategies: ConversionStrategy[] = ['conservative', 'moderate', 'aggressive', 'irmaa-aware'];
      if (!allowedStrategies.includes(strategy)) {
        return res.status(400).json({ 
          error: `Invalid strategy. Must be one of: ${allowedStrategies.join(', ')}` 
        });
      }
      
      // Fetch the complete financial profile from database
      const completeProfile = await db.query.financialProfiles.findFirst({
        where: eq(financialProfiles.userId, req.user!.id)
      });

      if (!completeProfile) {
        return res.status(404).json({ error: "Financial profile not found" });
      }
      
      // NEW: Validate optimization variables requirement
      const optimizationVars = completeProfile.optimizationVariables;
      const hasLockedOptimizationVars = optimizationVars?.isLocked && optimizationVars?.lockedAt;
      
      if (!hasLockedOptimizationVars) {
        return res.status(400).json({ 
          error: "Optimization variables must be locked before running Roth conversion analysis. Please complete and lock your retirement optimization variables first.",
          requiresOptimization: true
        });
      }
      
      // No need to initialize engine here - we'll do it after validation

      // Map the database fields to the engine's input schema
      const assets = completeProfile.assets as any[] || [];
      
      // Helper function to determine asset allocation model based on risk profile
      const getRiskBasedAllocation = (riskProfile: string | null): string => {
        switch (riskProfile?.toLowerCase()) {
          case 'conservative': return 'Conservative';
          case 'moderately conservative': return 'Balanced';
          case 'moderate': return 'Balanced';
          case 'moderately aggressive': return 'Balanced';
          case 'aggressive': return 'Aggressive Growth';
          default: return 'Balanced';
        }
      };

      // Determine the appropriate risk profile for allocation
      const userRiskProfile = completeProfile.riskProfile || 'moderate';
      const spouseRiskProfile = completeProfile.spouseRiskProfile || userRiskProfile;
      
      // Separate assets by owner and type
      const userAssets = assets.filter(asset => 
        asset.owner?.toLowerCase() === 'user' || asset.owner?.toLowerCase() === 'self' || 
        (!asset.owner && completeProfile.maritalStatus !== 'married')
      );
      const spouseAssets = assets.filter(asset => asset.owner?.toLowerCase() === 'spouse');
      const jointAssets = assets.filter(asset => asset.owner?.toLowerCase() === 'joint');

      // Helper function to map database asset types to engine asset types
      const mapAssetType = (dbType: string): string => {
        const typeMap: { [key: string]: string } = {
          'taxable-brokerage': 'Taxable',
          'brokerage': 'Brokerage',
          'traditional-ira': 'Traditional IRA',
          'roth-ira': 'Roth IRA',
          '401k': '401k',
          'traditional-401k': 'Traditional 401k',
          'roth-401k': 'Roth 401k',
          '403b': '403b',
          'traditional-403b': 'Traditional 403b',
          'roth-403b': 'Roth 403b',
          'hsa': 'HSA',
          'savings': 'Savings',
          'checking': 'Checking',
          'cash': 'Cash'
        };
        return typeMap[dbType.toLowerCase()] || dbType;
      };

      // Map assets to engine format with proper allocation models
      const engineAccounts = [
        ...userAssets.map(asset => ({
          account_type: mapAssetType(asset.type),
          owner: 'User' as const,
          balance: Number(asset.value) || 0,
          cost_basis: asset.type === 'taxable-brokerage' ? Number(asset.value) * 0.7 : undefined, // Assume 70% cost basis if not provided
          asset_allocation_model: getRiskBasedAllocation(userRiskProfile)
        })),
        ...spouseAssets.map(asset => ({
          account_type: mapAssetType(asset.type),
          owner: 'Spouse' as const,
          balance: Number(asset.value) || 0,
          cost_basis: asset.type === 'taxable-brokerage' ? Number(asset.value) * 0.7 : undefined, // Assume 70% cost basis if not provided
          asset_allocation_model: getRiskBasedAllocation(spouseRiskProfile)
        })),
        ...jointAssets.map(asset => ({
          account_type: mapAssetType(asset.type),
          owner: 'Joint' as const,
          balance: Number(asset.value) || 0,
          cost_basis: asset.type === 'taxable-brokerage' ? Number(asset.value) * 0.7 : undefined, // Assume 70% cost basis if not provided
          asset_allocation_model: getRiskBasedAllocation(userRiskProfile) // Use primary user's risk profile for joint
        }))
      ];
      
      // Calculate user's pre-tax deductions (401k contributions)
      const userMonthlyContributions = completeProfile.retirementContributions?.employee || 0;
      const userAnnualDeductions = Number(userMonthlyContributions) * 12;
      
      // For spouse deductions, check if there's a spouse retirement contribution field
      // If not, estimate based on spouse income (assume 6% contribution rate)
      const spouseAnnualDeductions = completeProfile.spouseAnnualIncome ? 
        Number(completeProfile.spouseAnnualIncome) * 0.06 : 0;

      // NEW: Use optimization variables as primary data source with intake form fallback
      const getRetirementAge = (optimizedAge?: number, fallbackAge?: number) => {
        const age = Number(optimizedAge || fallbackAge) || 67;
        return Math.max(50, Math.min(75, age)); // Validate age is within reasonable bounds
      };
      const getSocialSecurityAge = (optimizedAge?: number, fallbackAge?: number) => {
        const age = Number(optimizedAge || fallbackAge) || 67;
        return Math.max(62, Math.min(70, age)); // Validate Social Security age is within legal bounds
      };
      
      // Prepare inputs for the engine
      const engineInputs = {
        // Personal Information
        user_dob: completeProfile.dateOfBirth || new Date(new Date().getFullYear() - 45, 0, 1).toISOString(),
        spouse_dob: completeProfile.spouseDateOfBirth,
        user_retirement_age: getRetirementAge(optimizationVars.retirementAge, completeProfile.desiredRetirementAge),
        spouse_retirement_age: completeProfile.spouseDateOfBirth ? getRetirementAge(optimizationVars.spouseRetirementAge, completeProfile.spouseDesiredRetirementAge) : undefined,
        user_ss_claim_age: getSocialSecurityAge(optimizationVars.socialSecurityAge, completeProfile.socialSecurityClaimAge),
        spouse_ss_claim_age: completeProfile.spouseDateOfBirth ? getSocialSecurityAge(optimizationVars.spouseSocialSecurityAge, completeProfile.spouseSocialSecurityClaimAge) : undefined,
        longevity_age: Number(completeProfile.userLifeExpectancy) || 93,
        
        // Income Information
        user_gross_income: Number(completeProfile.annualIncome) || 0,
        spouse_gross_income: completeProfile.spouseDateOfBirth ? (Number(completeProfile.spouseAnnualIncome) || 0) : undefined,
        user_deductions: userAnnualDeductions, // Use calculated 401k contributions
        spouse_deductions: spouseAnnualDeductions, // Use calculated/estimated spouse deductions
        filing_status: completeProfile.maritalStatus === 'married' ? 'marriedFilingJointly' as const : 'single' as const,
        state_of_residence: completeProfile.state || 'CA',
        desired_monthly_retirement_expense: Number(completeProfile.expectedMonthlyExpensesRetirement) || 8000,
        
        // Account Information
        accounts: engineAccounts,
        
        // Social Security
        social_security_benefit: Number(completeProfile.socialSecurityBenefit) || 2500,
        // Estimate spouse Social Security benefit based on primary earner or use 50% of user's benefit
        spouse_social_security_benefit: completeProfile.spouseDateOfBirth ? 
          (completeProfile.spouseAnnualIncome && Number(completeProfile.spouseAnnualIncome) > Number(completeProfile.annualIncome) * 0.5 ?
            Number(completeProfile.socialSecurityBenefit) || 2500 : // If spouse earns more than 50% of user, assume similar benefit
            (Number(completeProfile.socialSecurityBenefit) || 2500) * 0.5) : // Otherwise use spousal benefit (50%)
          undefined
      };
      
      // Calculate current age for debugging
      const calculateAge = (dateOfBirth: string): number => {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      };
      
      const userAge = completeProfile.dateOfBirth ? calculateAge(completeProfile.dateOfBirth) : 45;
      
      // Validate inputs with Zod schema
      console.log('Validating inputs for RothConversionEngine...');
      console.log('User retirement age:', engineInputs.user_retirement_age);
      console.log('User DOB:', engineInputs.user_dob);
      console.log('Current user age:', userAge);
      const validatedInputs = RothConversionInputsSchema.parse(engineInputs);
      
      // Initialize the Roth Conversion Engine with validated inputs and strategy
      console.log(`Initializing RothConversionEngine with strategy: ${strategy}`);
      console.log('Account balances being passed:');
      const accountSummary = engineAccounts.reduce((acc, account) => {
        const key = `${account.owner} ${account.account_type}`;
        acc[key] = (acc[key] || 0) + account.balance;
        return acc;
      }, {} as Record<string, number>);
      Object.entries(accountSummary).forEach(([type, balance]) => {
        console.log(`  ${type}: $${balance.toLocaleString()}`);
      });
      // CRITICAL FIX: Use actual retirement planning income projections
      console.log('Calculating actual retirement income projections using withdrawal sequence logic...');
      const { calculateWithdrawalSequence } = await import("./retirement-withdrawal");
      
      // Prepare parameters for the withdrawal sequence calculation (same logic as Income tab)
      const withdrawalParams = {
        currentAge: userAge,
        retirementAge: engineInputs.user_retirement_age,
        spouseCurrentAge: completeProfile.spouseDateOfBirth ? calculateAge(completeProfile.spouseDateOfBirth) : undefined,
        spouseRetirementAge: engineInputs.spouse_retirement_age,
        lifeExpectancy: engineInputs.longevity_age,
        socialSecurityAge: engineInputs.user_ss_claim_age,
        spouseSocialSecurityAge: engineInputs.spouse_ss_claim_age,
        socialSecurityBenefit: engineInputs.social_security_benefit,
        spouseSocialSecurityBenefit: engineInputs.spouse_social_security_benefit,
        pensionBenefit: 0, // Not in current intake form
        spousePensionBenefit: 0,
        partTimeIncomeRetirement: 0, // Not in current intake form
        spousePartTimeIncomeRetirement: 0,
        annualIncome: engineInputs.user_gross_income,
        spouseAnnualIncome: engineInputs.spouse_gross_income || 0,
        monthlyExpenses: engineInputs.desired_monthly_retirement_expense,
        assets: {
          taxable: engineAccounts.filter(a => ['Taxable', 'Savings', 'Checking'].includes(a.account_type))
            .reduce((sum, a) => sum + a.balance, 0),
          taxDeferred: engineAccounts.filter(a => ['401k', 'Traditional IRA', 'Traditional 401k', 'Traditional 403b', '403b'].includes(a.account_type))
            .reduce((sum, a) => sum + a.balance, 0),
          taxFree: engineAccounts.filter(a => ['Roth IRA', 'Roth 401k', 'Roth 403b'].includes(a.account_type))
            .reduce((sum, a) => sum + a.balance, 0),
          hsa: engineAccounts.filter(a => a.account_type === 'HSA')
            .reduce((sum, a) => sum + a.balance, 0),
        },
        investmentReturns: {
          taxable: 0.06, // 6% return assumption
          taxDeferred: 0.06,
          taxFree: 0.06,
          hsa: 0.06,
        },
        inflationRate: 0.025, // 2.5%
        taxRate: 0.22, // Effective tax rate assumption
      };
      
      // Calculate the actual retirement income projections (same as Income tab)
      const actualIncomeProjections = calculateWithdrawalSequence(withdrawalParams);
      console.log('✅ Actual retirement income projections calculated using withdrawal sequence logic');
      console.log(`📊 Projected ${actualIncomeProjections.length} years of retirement income data`);
      
      const engine = new RothConversionEngine(validatedInputs, strategy, actualIncomeProjections, completeProfile);
      
      // Run the Roth Conversion Engine analysis
      console.log('Running RothConversionEngine analysis...');
      const analysisResult = await engine.analyze();
      console.log('RothConversionEngine analysis complete');

      // Compute after-heir-tax estate values using shared estate model (Option B)
      // Build baseline vs with-conversion overlays at a unified target age to match Estate Planning New (age 93)
      const baselineProjection = analysisResult.withoutConversionProjection;
      const conversionProjection = analysisResult.withConversionProjection;

      let baselineAfterHeirTax = analysisResult.estateValueWithoutConversion;
      let conversionAfterHeirTax = analysisResult.estateValueWithConversion;
      try {
        // Use the same target age as Estate Planning New: 93
        const estateTargetAge = 93;

        // Find rows at (or nearest below) the target death year in both projections
        const yearsUntilTarget = Math.max(0, estateTargetAge - userAge);
        const targetYear = new Date().getFullYear() + yearsUntilTarget;

        const pickRowAtTarget = (arr: any[]) =>
          Array.isArray(arr) && arr.length ? (
            arr.find((r: any) => r.year === targetYear) ||
            arr.slice().reverse().find((r: any) => r.year <= targetYear) ||
            arr[arr.length - 1]
          ) : null;

        const baseAtTarget = pickRowAtTarget(baselineProjection) || baselineProjection[baselineProjection.length - 1];
        const convAtTarget = pickRowAtTarget(conversionProjection) || conversionProjection[conversionProjection.length - 1];

        const retirementWithout = Math.max(0,
          (baseAtTarget?.traditionalBalance || 0) +
          (baseAtTarget?.rothBalance || 0) +
          (baseAtTarget?.taxableBalance || 0) +
          (baseAtTarget?.savingsBalance || 0)
        );
        const retirementWith = Math.max(0,
          (convAtTarget?.traditionalBalance || 0) +
          (convAtTarget?.rothBalance || 0) +
          (convAtTarget?.taxableBalance || 0) +
          (convAtTarget?.savingsBalance || 0)
        );

        // Project real estate to target death age (3% CAGR), keep constant across scenarios
        const yearsUntilDeath = yearsUntilTarget;
        const factor = Math.pow(1.03, yearsUntilDeath);
        const currentRE = (() => {
          try {
            const primaryMV = Number((completeProfile as any)?.primaryResidence?.marketValue || 0);
            const additional = Array.isArray((completeProfile as any)?.additionalProperties)
              ? (completeProfile as any).additionalProperties.reduce((sum: number, p: any) => sum + Number(p?.marketValue || 0), 0)
              : 0;
            return Math.max(0, primaryMV + additional);
          } catch { return 0; }
        })();
        const realEstateAtDeath = Math.round(currentRE * factor);

        // Align baseline retirement value with optimized Monte Carlo used in Estate Planning New
        let retirementAtTarget = 0;
        try {
          const impact: any = (completeProfile as any)?.retirementPlanningData?.impactOnPortfolioBalance;
          const hasOptimized = Boolean((completeProfile as any)?.optimizationVariables?.optimizedScore);
          const targetAge = estateTargetAge;
          if (impact?.projectionData && Array.isArray(impact.projectionData)) {
            const row = impact.projectionData.find((r: any) => Math.floor(r.age) === targetAge);
            if (row) {
              retirementAtTarget = hasOptimized ? Number(row.optimized || 0) : Number(row.baseline || 0);
            }
          }
          if (!retirementAtTarget || retirementAtTarget < 0) {
            const flows: any[] = (completeProfile as any)?.monteCarloSimulation?.retirementSimulation?.results?.yearlyCashFlows
              || (completeProfile as any)?.monteCarloSimulation?.retirementSimulation?.yearlyCashFlows
              || [];
            const r = Array.isArray(flows) && flows.length
              ? (flows.find((y: any) => Math.floor(y.age || 0) === targetAge) || flows[flows.length - 1])
              : null;
            if (r) retirementAtTarget = Number(r.portfolioValue || r.portfolioBalance || 0) || 0;
          }
        } catch {}

        const baseEstateWithout = Math.max(0, retirementAtTarget + realEstateAtDeath);
        const baseEstateWith = Math.max(0, retirementWith + realEstateAtDeath);

        const overlayIlliquid = (() => {
          try {
            const primaryMV = Number((completeProfile as any)?.primaryResidence?.marketValue || 0);
            const primaryMortgage = Number((completeProfile as any)?.primaryResidence?.mortgageBalance || 0);
            const additional = Array.isArray((completeProfile as any)?.additionalProperties)
              ? (completeProfile as any).additionalProperties.reduce((sum: number, p: any) => sum + (Number(p?.marketValue || 0) - Number(p?.mortgageBalance || 0)), 0)
              : 0;
            const equity = Math.max(0, (primaryMV - primaryMortgage) + additional);
            return equity;
          } catch { return 0; }
        })();

        const baselineSummary = calculateEstateProjection({
          baseEstateValue: baseEstateWithout,
          assetComposition: {
            taxable: Math.max(0, (baseAtTarget?.taxableBalance || 0) + (baseAtTarget?.savingsBalance || 0)),
            taxDeferred: Math.max(0, baseAtTarget?.traditionalBalance || 0),
            roth: Math.max(0, baseAtTarget?.rothBalance || 0),
            illiquid: overlayIlliquid,
          },
          assumptions: {
            projectedDeathAge: estateTargetAge,
            appreciationRate: 0,
          },
          profile: completeProfile,
        });

        const withSummary = calculateEstateProjection({
          baseEstateValue: baseEstateWith,
          assetComposition: {
            taxable: Math.max(0, (convAtTarget?.taxableBalance || 0) + (convAtTarget?.savingsBalance || 0)),
            taxDeferred: Math.max(0, convAtTarget?.traditionalBalance || 0),
            roth: Math.max(0, convAtTarget?.rothBalance || 0),
            illiquid: overlayIlliquid,
          },
          assumptions: {
            projectedDeathAge: estateTargetAge,
            appreciationRate: 0,
          },
          profile: completeProfile,
        });

        baselineAfterHeirTax = Math.max(0, baselineSummary.heirTaxEstimate.netAfterIncomeTax);
        conversionAfterHeirTax = Math.max(0, withSummary.heirTaxEstimate.netAfterIncomeTax);
      } catch (e) {
        console.warn("Falling back to engine estate values (pre-tax) due to estate projection error:", e);
      }

      // Format the engine results to match the expected UI format
      const formatCurrency = (amount: number) => `$${Math.round(amount).toLocaleString()}`;

      // Calculate some summary metrics from the projections
      // Calculate total taxes from projections
      const baselineTotalTaxes = baselineProjection.reduce((sum, year) => sum + year.totalTaxes, 0);
      const conversionTotalTaxes = conversionProjection.reduce((sum, year) => sum + year.totalTaxes, 0);
      
      // Calculate total RMDs
      const baselineTotalRMDs = baselineProjection.reduce((sum, year) => sum + year.rmdAmount, 0);
      const conversionTotalRMDs = conversionProjection.reduce((sum, year) => sum + year.rmdAmount, 0);
      
      // Calculate total IRMAA
      const baselineTotalIRMAA = baselineProjection.reduce((sum, year) => sum + year.irmaaSurcharge, 0);
      const conversionTotalIRMAA = conversionProjection.reduce((sum, year) => sum + year.irmaaSurcharge, 0);
      
      // Find peak RMD
      const peakRMD = Math.max(...baselineProjection.map(year => year.rmdAmount));
      
      // Get initial tax-deferred balance
      const initialTaxDeferred = engineInputs.accounts
        .filter(acc => ['401k', '403b', 'traditional-ira', 'other-tax-deferred'].includes(acc.account_type))
        .reduce((sum, acc) => sum + acc.balance, 0);
      
      // Transform engine results into the expected UI format
      const transformedResult = {
        analysis: {
          currentSituation: `Based on your financial profile, you have ${formatCurrency(initialTaxDeferred)} in tax-deferred retirement accounts. ${analysisResult.keyInsights[0] || 'Roth conversions could provide significant tax savings.'}`,
          keyConsiderations: analysisResult.keyInsights
        },
        baselineScenario: {
          name: "No Conversion Baseline",
          philosophy: "Continue current trajectory without any Roth conversions",
          projections: {
            lifetimeIncomeTaxes: baselineTotalTaxes,
            afterTaxEstateValueAt85: baselineAfterHeirTax,
            totalIRMAARisk: baselineTotalIRMAA,
            bracketCreepRisk: baselineTotalRMDs > 2000000 ? "High" : 
                              baselineTotalRMDs > 1000000 ? "Medium" : "Low",
            totalRMDsOverLifetime: baselineTotalRMDs
          },
          pros: [
            "No immediate tax payments required",
            "Maintains current cash flow flexibility",
            "Defers taxes until retirement"
          ],
          cons: [
            `Subject to RMDs starting at age 73 (estimated ${formatCurrency(peakRMD)} peak annual RMD)`,
            "Future tax rates may be higher",
            "Heirs will pay income tax on inherited traditional IRA assets",
            baselineTotalIRMAA > 0 ? `IRMAA surcharges estimated at ${formatCurrency(baselineTotalIRMAA)}` : "Risk of future IRMAA surcharges"
          ]
        },
        strategies: [
          {
            name: "Tax Bracket Filling Strategy",
            philosophy: "Convert up to the top of your current tax bracket each year during the golden window",
            annualConversions: analysisResult.conversionPlan.slice(0, 5).map((conv) => ({
              year: conv.year,
              age: conv.age,
              conversionAmount: conv.conversionAmount,
              taxOwed: conv.taxOwed,
              marginalRate: `${Math.round(conv.marginalRate * 100)}%`
            })),
            projections: {
              lifetimeIncomeTaxes: conversionTotalTaxes,
              afterTaxEstateValueAt85: conversionAfterHeirTax,
              totalIRMAARisk: conversionTotalIRMAA,
              bracketCreepRisk: "Low",
              totalRMDsOverLifetime: conversionTotalRMDs
            },
            pros: [
              `Saves ${formatCurrency(analysisResult.lifetimeTaxSavings)} in lifetime taxes`,
              `Increases after-tax estate value by ${formatCurrency(conversionAfterHeirTax - baselineAfterHeirTax)}`,
              "Reduces future RMDs and associated tax burden",
              "Creates tax-free income in retirement",
              "Tax-free inheritance for heirs"
            ],
            cons: [
              `Requires ${formatCurrency(analysisResult.totalConversions)} in conversions over ${analysisResult.conversionPlan.length} years`,
              "Immediate tax payments reduce current liquidity",
              "Need cash reserves to pay conversion taxes"
            ],
            comparisonToBaseline: {
              additionalTaxesPaid: analysisResult.conversionPlan.reduce((sum, conv) => sum + conv.taxOwed, 0),
              additionalEstateValue: conversionAfterHeirTax - baselineAfterHeirTax,
              netBenefit: (conversionAfterHeirTax - baselineAfterHeirTax) + analysisResult.lifetimeTaxSavings
            }
          }
        ],
        recommendation: {
          selectedStrategy: "Tax Bracket Filling Strategy",
          ranking: [
            "1. Tax Bracket Filling Strategy (Recommended)",
            "2. No Conversion Baseline"
          ],
          justification: analysisResult.recommendedStrategy,
          implementationPlan: {
            nextFiveYears: analysisResult.conversionPlan.slice(0, 5).map((conv) => {
              // Determine which tax-deferred accounts have funds for conversion
              const taxDeferredAccounts = engineAccounts
                .filter(account => 
                  ['Traditional IRA', '401k', '403b', 'Traditional 401k', 'Traditional 403b'].includes(account.account_type) &&
                  account.balance > 0
                )
                .sort((a, b) => b.balance - a.balance); // Sort by balance, highest first

              // Build conversion source description
              let conversionSource = "Traditional IRA"; // Default fallback
              
              if (taxDeferredAccounts.length > 0) {
                // Helper to format account type names
                const formatAccountType = (type: string): string => {
                  if (type === '401k' || type === 'Traditional 401k') return '401(k)';
                  if (type === '403b' || type === 'Traditional 403b') return '403(b)';
                  if (type === 'Traditional IRA') return 'Traditional IRA';
                  return type;
                };

                // Use the account with the highest balance
                const primaryAccount = taxDeferredAccounts[0];
                conversionSource = formatAccountType(primaryAccount.account_type);
                
                // If spouse has the account, use their name
                if (primaryAccount.owner === 'Spouse' && completeProfile.maritalStatus === 'married') {
                  const spouseFirstName = completeProfile.spouseName?.split(' ')[0] || 'Spouse';
                  conversionSource = `${spouseFirstName}'s ${conversionSource}`;
                } else if (primaryAccount.owner === 'User') {
                  const userFirstName = completeProfile.firstName || 'Your';
                  conversionSource = `${userFirstName}'s ${conversionSource}`;
                }
                
                // If there are multiple account types, maintain personalization
                if (taxDeferredAccounts.length > 1) {
                  // Group by owner
                  const userAccounts = taxDeferredAccounts.filter(a => a.owner === 'User');
                  const spouseAccounts = taxDeferredAccounts.filter(a => a.owner === 'Spouse');
                  
                  // If all accounts belong to the same person, just list account types
                  if (userAccounts.length === taxDeferredAccounts.length || spouseAccounts.length === taxDeferredAccounts.length) {
                    const accountTypes = [...new Set(taxDeferredAccounts.map(a => formatAccountType(a.account_type)))];
                    if (accountTypes.length > 1) {
                      const ownerName = primaryAccount.owner === 'Spouse' ? 
                        (completeProfile.spouseName?.split(' ')[0] || 'Spouse') : 
                        (completeProfile.firstName || 'Your');
                      conversionSource = `${ownerName}'s ${accountTypes.join(' or ')}`;
                    }
                  }
                  // If accounts belong to both spouses, keep the primary account's personalization
                  // (Already handled above)
                }
              }

              return {
                year: conv.year,
                age: conv.age,
                conversionAmount: conv.conversionAmount,
                taxOwed: conv.taxOwed,
                taxPaymentSource: conv.paymentSource,
                actions: [
                  `Convert ${formatCurrency(conv.conversionAmount)} from ${conversionSource} to Roth IRA`,
                  `Pay ${formatCurrency(conv.taxOwed)} in taxes from ${conv.paymentSource}`,
                  "File Form 8606 with your tax return",
                  "Consider quarterly estimated tax payments if needed"
                ]
              };
            }),
            keyMilestones: [
              `Start conversions in ${analysisResult.conversionPlan[0]?.year || new Date().getFullYear() + 1}`,
              "Complete major conversions before RMDs begin at age 73",
              "Monitor tax brackets and IRMAA thresholds annually"
            ],
            riskMitigation: analysisResult.warnings
          }
        },
        // Provide the full schedule so the UI can show all years
        conversionPlan: analysisResult.conversionPlan,
        disclaimer: "This analysis is for educational purposes only and should not replace personalized advice from a qualified financial advisor. Tax laws are complex and subject to change. Please consult with a tax professional before implementing any Roth conversion strategy."
      };

      // Save analysis results to database for persistence
      const currentDateTime = new Date().toISOString();
      const analysisData = {
        results: analysisResult,
        inputs: validatedInputs,
        strategy: strategy,
        calculatedAt: currentDateTime,
        lifetimeTaxSavings: analysisResult.lifetimeTaxSavings,
        totalConversions: analysisResult.totalConversions,
        estateValueIncrease: conversionAfterHeirTax - baselineAfterHeirTax,
        conversionYears: analysisResult.conversionPlan.length,
        transformedResult: transformedResult
      };
      
      // Update the calculations field in the financial profile
      const updatedCalculations = {
        ...(completeProfile.calculations || {}),
        rothConversionAnalysis: analysisData
      };
      
      // Save to database
      await db.update(financialProfiles)
        .set({ 
          calculations: updatedCalculations,
          updatedAt: new Date()
        })
        .where(eq(financialProfiles.userId, req.user!.id));
      
      console.log('✅ Roth conversion analysis results saved to database');
      
      res.json(transformedResult);
    } catch (error) {
      console.error('Error in comprehensive Roth conversion analysis:', error);
      res.status(500).json({ error: 'Failed to generate comprehensive Roth conversion analysis' });
    }
  });

  // Get stored Roth conversion analysis results
  app.get("/api/roth-conversion/analysis", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const profile = await db.query.financialProfiles.findFirst({
        where: eq(financialProfiles.userId, req.user!.id)
      });

      if (!profile || !profile.calculations || !profile.calculations.rothConversionAnalysis) {
        return res.status(404).json({ 
          error: "No Roth conversion analysis found. Please run an analysis first." 
        });
      }

      const analysisData = profile.calculations.rothConversionAnalysis;

      // Prepare response, but first attempt to recompute after-heir-tax estate values at age 93
      // from stored raw projections to ensure consistency with Estate Planning New.
      let summaryEstateIncrease = analysisData.estateValueIncrease;
      let resultsOut: any = analysisData.transformedResult || analysisData.results;
      const raw = analysisData.results;

      try {
        if (raw && Array.isArray(raw.withoutConversionProjection) && Array.isArray(raw.withConversionProjection)) {
          const userDob = (profile as any)?.dateOfBirth || (profile as any)?.userDob || (raw as any)?.user_dob;
          const userAge = (() => {
            try {
              const d = new Date(userDob);
              if (!isNaN(d.getTime())) return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25)));
            } catch {}
            return Number((profile as any)?.currentAge || (raw as any)?.currentAge || 55);
          })();

          const estateTargetAge = 93;
          const yearsUntilTarget = Math.max(0, estateTargetAge - userAge);
          const targetYear = new Date().getFullYear() + yearsUntilTarget;
          const pickRowAtTarget = (arr: any[]) =>
            Array.isArray(arr) && arr.length ? (
              arr.find((r: any) => r.year === targetYear) ||
              arr.slice().reverse().find((r: any) => r.year <= targetYear) ||
              arr[arr.length - 1]
            ) : null;

          const baseAtTarget = pickRowAtTarget(raw.withoutConversionProjection);
          const convAtTarget = pickRowAtTarget(raw.withConversionProjection);

          if (baseAtTarget && convAtTarget) {
            // 1) Compute retirement at target and real estate to age 93
            const retirementWithout = Math.max(0,
              (baseAtTarget?.traditionalBalance || 0) +
              (baseAtTarget?.rothBalance || 0) +
              (baseAtTarget?.taxableBalance || 0) +
              (baseAtTarget?.savingsBalance || 0)
            );
            const retirementWith = Math.max(0,
              (convAtTarget?.traditionalBalance || 0) +
              (convAtTarget?.rothBalance || 0) +
              (convAtTarget?.taxableBalance || 0) +
              (convAtTarget?.savingsBalance || 0)
            );

            const currentRE = (() => {
              try {
                const primaryMV = Number((profile as any)?.primaryResidence?.marketValue || 0);
                const additional = Array.isArray((profile as any)?.additionalProperties)
                  ? (profile as any).additionalProperties.reduce((sum: number, p: any) => sum + Number(p?.marketValue || 0), 0)
                  : 0;
                return Math.max(0, primaryMV + additional);
              } catch { return 0; }
            })();
            const factor = Math.pow(1.03, yearsUntilTarget);
            const realEstateAtDeath = Math.round(currentRE * factor);

            // 2) Align baseline retirement value with the Overview (optimized MC at 93)
            let retirementAtTarget = 0;
            try {
              const impact: any = (profile as any)?.retirementPlanningData?.impactOnPortfolioBalance;
              const hasOptimized = Boolean((profile as any)?.optimizationVariables?.optimizedScore);
              if (impact?.projectionData && Array.isArray(impact.projectionData)) {
                const row = impact.projectionData.find((r: any) => Math.floor(r.age) === estateTargetAge);
                if (row) retirementAtTarget = hasOptimized ? Number(row.optimized || 0) : Number(row.baseline || 0);
              }
              if (!retirementAtTarget || retirementAtTarget < 0) {
                const flows: any[] = (profile as any)?.monteCarloSimulation?.retirementSimulation?.results?.yearlyCashFlows
                  || (profile as any)?.monteCarloSimulation?.retirementSimulation?.yearlyCashFlows
                  || [];
                const r = Array.isArray(flows) && flows.length
                  ? (flows.find((y: any) => Math.floor(y.age || 0) === estateTargetAge) || flows[flows.length - 1])
                  : null;
                if (r) retirementAtTarget = Number(r.portfolioValue || r.portfolioBalance || 0) || 0;
              }
            } catch {}

            // 3) Mirror Overview baseline/overlay construction
            const projectedEstateValue = Math.max(0, retirementAtTarget + realEstateAtDeath);
            const baselineRetirement = retirementAtTarget;
            const rothRetirement = retirementWith; // engine with-conversion retirement sum at target
            const baseEstateValueRoth = Math.max(0, projectedEstateValue - baselineRetirement + rothRetirement);

            // Use the same baseline composition as Overview (from profile), keep illiquid constant
            const profileComposition = buildAssetCompositionFromProfile(profile || {});
            const overlayComposition = {
              taxable: Math.max(0, (convAtTarget?.taxableBalance || 0) + (convAtTarget?.savingsBalance || 0)),
              taxDeferred: Math.max(0, convAtTarget?.traditionalBalance || 0),
              roth: Math.max(0, convAtTarget?.rothBalance || 0),
              illiquid: Math.max(0, profileComposition.illiquid || 0),
            };

            const baselineSummary = calculateEstateProjection({
              baseEstateValue: projectedEstateValue,
              assetComposition: profileComposition,
              assumptions: { projectedDeathAge: estateTargetAge, appreciationRate: 0 },
              profile,
            });

            const withSummary = calculateEstateProjection({
              baseEstateValue: baseEstateValueRoth,
              assetComposition: overlayComposition,
              assumptions: { projectedDeathAge: estateTargetAge, appreciationRate: 0 },
              profile,
            });

            const baselineAfterHeir = Math.max(0, baselineSummary.heirTaxEstimate.netAfterIncomeTax);
            const withAfterHeir = Math.max(0, withSummary.heirTaxEstimate.netAfterIncomeTax);
            summaryEstateIncrease = withAfterHeir - baselineAfterHeir;

            // Also update transformed result projections so UI tiles that derive differences from them align
            if (resultsOut && resultsOut.baselineScenario && resultsOut.baselineScenario.projections) {
              resultsOut.baselineScenario.projections.afterTaxEstateValueAt85 = baselineAfterHeir;
            }
            if (resultsOut && Array.isArray(resultsOut.strategies) && resultsOut.strategies[0]?.projections) {
              resultsOut.strategies[0].projections.afterTaxEstateValueAt85 = withAfterHeir;
            }
          }
        }
      } catch (e) {
        console.warn('[GET /api/roth-conversion/analysis] Could not recompute estate overlay at 93:', (e as any)?.message || e);
      }

      res.json({
        hasAnalysis: true,
        calculatedAt: analysisData.calculatedAt,
        strategy: analysisData.strategy,
        summary: {
          lifetimeTaxSavings: analysisData.lifetimeTaxSavings,
          totalConversions: analysisData.totalConversions,
          estateValueIncrease: summaryEstateIncrease,
          conversionYears: analysisData.conversionYears
        },
        // Maintain existing client contract: primary 'results' preferred for transformed UI payload
        results: resultsOut,
        // Always include raw engine results for advanced consumers (e.g., estate overlay)
        rawResults: analysisData.results
      });
    } catch (error) {
      console.error('Error retrieving Roth conversion analysis:', error);
      res.status(500).json({ error: 'Failed to retrieve Roth conversion analysis' });
    }
  });

  // Debug endpoint: compute after-tax estate delta at age 93 using the exact
  // Estate Planning New approach (baseline from profile MC + real estate; overlay from Roth engine).
  app.get("/api/roth-conversion/analysis-debug", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const userId = req.user!.id;

      const profile = await storage.getFinancialProfile(userId);
      const estatePlan = await storage.getEstatePlan(userId);
      const calculations = profile?.calculations as any;
      const saved = calculations?.rothConversionAnalysis;
      if (!saved?.results?.withConversionProjection || !saved?.results?.withoutConversionProjection) {
        return res.status(404).json({ error: "No saved Roth analysis raw projections" });
      }

      const raw = saved.results;
      const getAge = (iso?: string) => {
        try { if (!iso) return undefined; const d = new Date(iso); if (isNaN(d.getTime())) return undefined; return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))); } catch { return undefined; }
      };
      const currentAge = (profile as any)?.currentAge ?? getAge((profile as any)?.dateOfBirth) ?? 55;
      const spouseAge = (profile as any)?.spouseCurrentAge ?? getAge((profile as any)?.spouseDateOfBirth);
      const elderAge = typeof spouseAge === 'number' ? Math.max(currentAge, spouseAge) : currentAge;

      const impact: any = (profile as any)?.retirementPlanningData?.impactOnPortfolioBalance;
      let retirementAt93 = 0; const optimized = Boolean((profile as any)?.optimizationVariables?.optimizedScore);
      if (impact?.projectionData && Array.isArray(impact.projectionData)) {
        const row = impact.projectionData.find((r: any) => Math.floor(r.age) === 93);
        if (row) retirementAt93 = optimized ? Number(row.optimized || 0) : Number(row.baseline || 0);
      }
      if (!retirementAt93 || retirementAt93 < 0) {
        const flows: any[] = (profile as any)?.monteCarloSimulation?.retirementSimulation?.results?.yearlyCashFlows
          || (profile as any)?.monteCarloSimulation?.retirementSimulation?.yearlyCashFlows || [];
        const r = Array.isArray(flows) && flows.length ? (flows.find((y: any) => Math.floor(y.age || 0) === 93) || flows[flows.length - 1]) : null;
        if (r) retirementAt93 = Number(r.portfolioValue || r.portfolioBalance || 0) || 0;
      }

      const primaryMV = Number((profile as any)?.primaryResidence?.marketValue || 0);
      const additionalMV = Array.isArray((profile as any)?.additionalProperties)
        ? (profile as any).additionalProperties.reduce((s: number, p: any) => s + Number(p?.marketValue || 0), 0)
        : 0;
      const yearsTo93 = Math.max(0, 93 - elderAge);
      const realEstateAt93 = Math.round(Math.max(0, primaryMV + additionalMV) * Math.pow(1.03, yearsTo93));
      const baseEstateValue = Math.max(0, retirementAt93 + realEstateAt93);

      const pickRowAtTarget = (arr: any[]) => Array.isArray(arr) && arr.length ? (
        arr.find((r: any) => r.year === (new Date().getFullYear() + yearsTo93)) ||
        arr.slice().reverse().find((r: any) => r.year <= (new Date().getFullYear() + yearsTo93)) ||
        arr[arr.length - 1]
      ) : null;

      const convAtTarget = pickRowAtTarget(raw.withConversionProjection);
      if (!convAtTarget) return res.status(400).json({ error: 'No with-conversion row at death year' });

      const traditional = Math.max(0, Number(convAtTarget?.traditionalBalance || 0));
      const rothBal = Math.max(0, Number(convAtTarget?.rothBalance || 0));
      const taxable = Math.max(0, Number(convAtTarget?.taxableBalance || 0));
      const savings = Math.max(0, Number(convAtTarget?.savingsBalance || 0));
      const rothRetirement = traditional + rothBal + taxable + savings;

      const profileComposition = buildAssetCompositionFromProfile(profile || {});
      const overlayComposition = {
        taxable: taxable + savings,
        taxDeferred: traditional,
        roth: rothBal,
        illiquid: Math.max(0, profileComposition.illiquid || 0),
      };

      // Extract strategies/assumptions minimally from estatePlan
      const extractStrategies = (plan: any, prof: any) => {
        try {
          if (!plan) { const fromIntake = Number(prof?.legacyGoal || 0) || undefined; return fromIntake && fromIntake > 0 ? { charitableBequest: fromIntake } : {}; }
          const trustStrategies = Array.isArray(plan.trustStrategies) ? plan.trustStrategies : [];
          const trustFunding = trustStrategies.map((s: any) => ({ label: s?.name || s?.type || 'Trust Strategy', amount: Number(s?.fundingAmount || s?.amount || 0) })).filter((i: any) => Number.isFinite(i.amount) && i.amount > 0);
          const gifting = plan.analysisResults?.gifting || {};
          const insurance = plan.analysisResults?.insurance || {};
          const charitable = plan.charitableGifts || plan.analysisResults?.charitable || {};
          const fromPlan = Number(charitable?.plannedTotal || charitable?.amount || charitable?.bequestAmount || 0) || undefined;
          const fromIntake = Number(prof?.legacyGoal || 0) || undefined;
          const resolvedCharity = (fromPlan && fromPlan > 0) ? fromPlan : (fromIntake && fromIntake > 0 ? fromIntake : undefined);
          return {
            lifetimeGifts: Number(gifting?.lifetimeGifts || plan?.lifetimeGiftAmount || 0) || undefined,
            annualGiftAmount: Number(gifting?.annualGiftAmount || plan?.annualGiftAmount || 0) || undefined,
            trustFunding: trustFunding.length ? trustFunding : undefined,
            charitableBequest: resolvedCharity,
            ilitDeathBenefit: Number(insurance?.ilitDeathBenefit || insurance?.deathBenefit || 0) || undefined,
            bypassTrust: Boolean(plan?.analysisResults?.strategies?.bypassTrust || trustStrategies.some((st: any) => String(st?.type || '').toLowerCase().includes('bypass'))),
          } as any;
        } catch { return {} as any; }
      };
      const extractAssumptions = (plan: any, prof: any) => {
        try {
          const assumptions = plan?.analysisResults?.assumptions || {};
          return {
            projectedDeathAge: 93,
            federalExemptionOverride: Number(assumptions?.federalExemption || plan?.federalExemptionUsed || 0) || undefined,
            stateOverride: assumptions?.stateOverride || prof?.estatePlanningState || undefined,
            portability: assumptions?.portability ?? undefined,
            dsueAmount: Number(assumptions?.dsueAmount || 0) || undefined,
            liquidityTargetPercent: Number(assumptions?.liquidityTarget || 110) || undefined,
            appreciationRate: 0,
            assumedHeirIncomeTaxRate: Number(assumptions?.heirIncomeTaxRate || 0) || undefined,
            currentAge,
          } as any;
        } catch { return { projectedDeathAge: 93, currentAge, appreciationRate: 0 } as any; }
      };

      const strategies = extractStrategies(estatePlan, profile);
      const assumptions = extractAssumptions(estatePlan, profile);

      const baselineSummary = calculateEstateProjection({
        baseEstateValue,
        assetComposition: profileComposition,
        strategies,
        assumptions,
        profile,
      });

      const baseEstateValueRoth = Math.max(0, baseEstateValue - retirementAt93 + rothRetirement);
      const withSummary = calculateEstateProjection({
        baseEstateValue: baseEstateValueRoth,
        assetComposition: overlayComposition,
        strategies,
        assumptions,
        profile,
      });

      const baselineAfterHeir = Math.max(0, baselineSummary.heirTaxEstimate.netAfterIncomeTax);
      const withAfterHeir = Math.max(0, withSummary.heirTaxEstimate.netAfterIncomeTax);
      const delta = withAfterHeir - baselineAfterHeir;

      res.json({
        baselineAfterHeir,
        withAfterHeir,
        delta,
        pieces: {
          retirementAt93,
          realEstateAt93,
          baseEstateValue,
          rothRetirementAt93: rothRetirement,
          baseEstateValueRoth,
          compositionBaseline: profileComposition,
          compositionOverlay: overlayComposition,
          strategies,
          assumptions,
        },
        serverSummaryEstateIncrease: saved?.estateValueIncrease,
        tileValues: {
          baselineTile: saved?.transformedResult?.baselineScenario?.projections?.afterTaxEstateValueAt85,
          withTile: saved?.transformedResult?.strategies?.[0]?.projections?.afterTaxEstateValueAt85,
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Debug calc failed', message: e?.message || String(e) });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}

// Helper functions for estate calculations
function calculateTotalAssets(profile: any): number {
  let total = 0;
  
  // Add liquid assets
  const assets = Array.isArray(profile.assets) ? profile.assets : [];
  total += assets.reduce((sum: number, asset: any) => sum + (asset.value || 0), 0);
  
  // Add real estate
  if (profile.primaryResidence) {
    total += profile.primaryResidence.marketValue || 0;
  }
  
  const additionalProperties = Array.isArray(profile.additionalProperties) ? profile.additionalProperties : [];
  total += additionalProperties.reduce((sum: number, prop: any) => sum + (prop.marketValue || 0), 0);
  
  // Add life insurance if owned (not in ILIT)
  if (profile.lifeInsurance?.hasPolicy) {
    total += profile.lifeInsurance.coverageAmount || 0;
  }
  
  return total;
}

function calculateTotalLiabilities(profile: any): number {
  let total = 0;
  
  // Add general liabilities
  const liabilities = Array.isArray(profile.liabilities) ? profile.liabilities : [];
  total += liabilities.reduce((sum: number, liability: any) => sum + (liability.balance || 0), 0);
  
  // Add mortgage
  if (profile.primaryResidence) {
    total += profile.primaryResidence.mortgageBalance || 0;
  }
  
  const additionalProperties = Array.isArray(profile.additionalProperties) ? profile.additionalProperties : [];
  total += additionalProperties.reduce((sum: number, prop: any) => sum + (prop.mortgageBalance || 0), 0);
  
  return total;
}

function calculateNetWorth(profile: any): number {
  return calculateTotalAssets(profile) - calculateTotalLiabilities(profile);
}

// Calculate estate analysis with tax projections
async function calculateEstateAnalysis(plan: EstatePlan, userId: number): Promise<any> {
  const profile = await storage.getFinancialProfile(userId);
  if (!profile) return {};
  const currentYear = new Date().getFullYear();
  const inputEstateValue = parseFloat(plan.totalEstateValue?.toString() || '0');

  // Derive current and spouse ages (fallbacks included)
  const parseAge = (iso?: string) => {
    try {
      if (!iso) return undefined as number | undefined;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return undefined;
      const diff = Date.now() - d.getTime();
      return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
    } catch { return undefined as number | undefined; }
  };
  const userAge = (profile as any).currentAge ?? parseAge((profile as any).dateOfBirth) ?? 55;
  const spouseAge = (profile as any).spouseCurrentAge ?? parseAge((profile as any).spouseDateOfBirth);
  const elderAge = typeof spouseAge === 'number' ? Math.max(userAge, spouseAge) : userAge;
  const deathAge = 93;
  const yearsUntilDeath = Math.max(0, deathAge - elderAge);
  const yearOfDeath = currentYear + yearsUntilDeath;

  // Project retirement assets at age 93 (prefer optimized impact cache, fallback to baseline Monte Carlo)
  let retirementAt93 = 0;
  try {
    const impact: any = (profile as any)?.retirementPlanningData?.impactOnPortfolioBalance;
    const hasOptimized = Boolean((profile as any)?.optimizationVariables?.optimizedScore);
    if (impact?.projectionData && Array.isArray(impact.projectionData)) {
      const row = impact.projectionData.find((r: any) => Math.floor(r.age) === 93);
      if (row) retirementAt93 = hasOptimized ? Number(row.optimized || 0) : Number(row.baseline || 0);
    }
    if (!retirementAt93 || retirementAt93 < 0) {
      const flows: any[] = (profile as any)?.monteCarloSimulation?.retirementSimulation?.results?.yearlyCashFlows
        || (profile as any)?.monteCarloSimulation?.retirementSimulation?.yearlyCashFlows
        || [];
      const r = Array.isArray(flows) && flows.length
        ? (flows.find((y: any) => Math.floor(y.age || 0) === 93) || flows[flows.length - 1])
        : null;
      if (r) retirementAt93 = Number(r.portfolioValue || r.portfolioBalance || 0) || 0;
    }
  } catch {}

  // Project real estate at 3% CAGR to age 93 (assume mortgage paid off by 93)
  let realEstateAt93 = 0;
  try {
    const primaryMV = Number((profile as any)?.primaryResidence?.marketValue || 0);
    const additional = Array.isArray((profile as any)?.additionalProperties)
      ? (profile as any).additionalProperties.reduce((sum: number, p: any) => sum + Number(p?.marketValue || 0), 0)
      : 0;
    const currentRE = Math.max(0, primaryMV + additional);
    const factor = Math.pow(1.03, yearsUntilDeath);
    realEstateAt93 = Math.round(currentRE * factor);
  } catch {}

  const projectedEstateValue = Math.max(0, retirementAt93) + Math.max(0, realEstateAt93);
  const totalEstateValue = projectedEstateValue > 0 ? projectedEstateValue : inputEstateValue;

  // Federal estate tax exemption (OBBA from 2026)
  const { getFederalExemption, StateEstateTaxByCode } = await import('../shared/estate-tax-config');
  const basicExclusion = getFederalExemption(yearOfDeath);
  const isMarried = profile.maritalStatus === 'married';
  const totalExemption = isMarried ? basicExclusion * 2 : basicExclusion;

  // Federal estate tax calculation (flat 40% on taxable amount)
  const federalTaxableEstate = Math.max(0, totalEstateValue - totalExemption);
  const federalEstateTax = federalTaxableEstate * 0.40;

  // State estate tax calculation by configured table
  const state = (profile.state || 'CA').toUpperCase();
  const cfg: any = (StateEstateTaxByCode as any)[state];
  let stateExemption = 0;
  let stateTaxable = 0;
  let stateEstateTax = 0;
  if (cfg) {
    stateExemption = cfg.exemption || 0;
    stateTaxable = Math.max(0, totalEstateValue - stateExemption);
    let remaining = stateTaxable;
    if (stateTaxable > 0) {
      const brackets = cfg.brackets || [];
      for (const b of brackets) {
        if (remaining <= 0) break;
        const max = b.max ?? Infinity;
        const min = b.min ?? 0;
        const span = Math.min(remaining, max === Infinity ? remaining : Math.max(0, max - min));
        stateEstateTax += span * (b.rate ?? 0);
        remaining -= span;
      }
    }
  }

  // Distribution analysis
  const beneficiaries = await storage.getEstateBeneficiaries(userId, plan.id);
  const netToHeirs = totalEstateValue - federalEstateTax - stateEstateTax;

  return {
    totalEstateValue,
    inputEstateValue,
    projectedEstateValue,
    retirementAt93,
    realEstateAt93,
    federalExemption: totalExemption,
    federalTaxableEstate,
    federalEstateTax,
    stateExemption,
    stateTaxable, 
    stateEstateTax,
    totalEstateTax: federalEstateTax + stateEstateTax,
    netToHeirs,
    effectiveTaxRate: totalEstateValue > 0 ? ((federalEstateTax + stateEstateTax) / totalEstateValue) * 100 : 0,
    beneficiaryCount: beneficiaries.length,
    assumptions: {
      yearOfDeath,
      deathAge,
      currentAge: elderAge,
      state,
    },
    recommendations: generateEstatePlanningRecommendations(plan, profile, {
      federalEstateTax,
      stateEstateTax,
      totalEstateValue,
      netToHeirs
    })
  };
}

// All Monte Carlo functions now imported from the enhanced version
import { 
  runEnhancedMonteCarloSimulation,
  runRightCapitalStyleMonteCarloSimulation,
  profileToRetirementParams,
  calculateEducationProjectionWithMonteCarlo 
} from './monte-carlo-enhanced';
import { mcPool } from './services/mc-pool';
import { analyzeRetirementGaps } from './retirement-gap-analyzer';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { calculateWithdrawalSequence, aggregateAssetsByType } from './retirement-withdrawal';
import { calculateMonteCarloWithdrawalSequence as generateMonteCarloWithdrawalSequence } from './monte-carlo-withdrawal-sequence';

// Helper function to analyze retirement account eligibility and contribution room
function analyzeRetirementContributionOpportunities(profile: any, metrics: any) {
  const currentYear = new Date().getFullYear();
  const age = profile.dateOfBirth ? 
    currentYear - new Date(profile.dateOfBirth).getFullYear() : 35;
  const spouseAge = profile.spouseDateOfBirth ? 
    currentYear - new Date(profile.spouseDateOfBirth).getFullYear() : null;
  
  const opportunities = [];
  
  // Get current retirement accounts
  const assets = profile.assets || [];
  const hasTraditionalIRA = assets.some((a: any) => a.type === 'traditional-ira');
  const hasRothIRA = assets.some((a: any) => a.type === 'roth-ira');
  const has401k = assets.some((a: any) => a.type === '401k');
  const hasSolo401k = assets.some((a: any) => a.type === 'solo-401k');
  
  // Calculate available cash flow for contributions
  const monthlyCashFlow = metrics.monthlyCashFlow || 0;
  const annualCashFlow = monthlyCashFlow * 12;
  
  // Check employment status for Solo 401(k) eligibility
  const isSelfEmployed = profile.employmentStatus === 'self-employed' || 
                         profile.employmentStatus === 'business-owner';
  const spouseSelfEmployed = profile.spouseEmploymentStatus === 'self-employed' || 
                             profile.spouseEmploymentStatus === 'business-owner';
  
  // IRA contribution limits for 2024
  const iraLimit = age >= 50 ? 8000 : 7000;
  const spouseIraLimit = spouseAge && spouseAge >= 50 ? 8000 : 7000;
  
  // 401(k) contribution limits for 2024
  const regularLimit401k = age >= 50 ? 30500 : 23000;
  const spouseLimit401k = spouseAge && spouseAge >= 50 ? 30500 : 23000;
  
  // Solo 401(k) limits (employee + employer contributions)
  const solo401kLimit = age >= 50 ? 76500 : 69000;
  const spouseSolo401kLimit = spouseAge && spouseAge >= 50 ? 76500 : 69000;
  
  // Track current contributions
  const currentContributions = (profile.retirementContributions?.employee || 0) + 
                               (profile.retirementContributions?.employer || 0);
  const spouseContributions = (profile.spouseRetirementContributions?.employee || 0) + 
                              (profile.spouseRetirementContributions?.employer || 0);
  
  // Traditional/Roth IRA opportunities
  if (!hasTraditionalIRA && !hasRothIRA && annualCashFlow > iraLimit) {
    const recommendedType = (profile.annualIncome || 0) > 150000 ? 'Traditional' : 'Roth';
    opportunities.push({
      account: `${recommendedType} IRA`,
      maxContribution: iraLimit,
      recommendedContribution: Math.min(iraLimit, annualCashFlow * 0.15),
      owner: 'user',
      priority: 1,
      impact: 'High',
      description: `Open a ${recommendedType} IRA and contribute up to $${iraLimit.toLocaleString()}/year. This provides ${recommendedType === 'Traditional' ? 'immediate tax deduction' : 'tax-free growth'}.`
    });
  }
  
  // Spouse IRA opportunities
  if (profile.maritalStatus === 'married' && spouseAge && annualCashFlow > iraLimit + spouseIraLimit) {
    const spouseAssets = assets.filter((a: any) => a.owner === 'spouse');
    const spouseHasIRA = spouseAssets.some((a: any) => 
      a.type === 'traditional-ira' || a.type === 'roth-ira');
    
    if (!spouseHasIRA) {
      const spouseRecommendedType = (profile.spouseAnnualIncome || 0) > 150000 ? 'Traditional' : 'Roth';
      opportunities.push({
        account: `Spouse ${spouseRecommendedType} IRA`,
        maxContribution: spouseIraLimit,
        recommendedContribution: Math.min(spouseIraLimit, annualCashFlow * 0.1),
        owner: 'spouse',
        priority: 2,
        impact: 'High',
        description: `Open a ${spouseRecommendedType} IRA for your spouse and contribute up to $${spouseIraLimit.toLocaleString()}/year.`
      });
    }
  }
  
  // Solo 401(k) opportunities for self-employed
  if (isSelfEmployed && !hasSolo401k && annualCashFlow > 20000) {
    const businessIncome = profile.annualIncome || 0;
    const maxEmployeeContribution = regularLimit401k;
    const maxEmployerContribution = Math.min(businessIncome * 0.25, solo401kLimit - maxEmployeeContribution);
    const totalMax = maxEmployeeContribution + maxEmployerContribution;
    
    opportunities.push({
      account: 'Solo 401(k)',
      maxContribution: totalMax,
      recommendedContribution: Math.min(totalMax, annualCashFlow * 0.25),
      owner: 'user',
      priority: 1,
      impact: 'Very High',
      description: `As a self-employed individual, open a Solo 401(k) and contribute up to $${totalMax.toLocaleString()}/year (employee: $${maxEmployeeContribution.toLocaleString()} + employer: $${maxEmployerContribution.toLocaleString()}).`
    });
  }
  
  // Spouse Solo 401(k) opportunities
  if (spouseSelfEmployed && profile.maritalStatus === 'married' && annualCashFlow > 30000) {
    const spouseBusinessIncome = profile.spouseAnnualIncome || 0;
    const spouseMaxEmployee = spouseLimit401k;
    const spouseMaxEmployer = Math.min(spouseBusinessIncome * 0.25, spouseSolo401kLimit - spouseMaxEmployee);
    const spouseTotalMax = spouseMaxEmployee + spouseMaxEmployer;
    
    const spouseHasSolo401k = assets.some((a: any) => 
      a.type === 'solo-401k' && a.owner === 'spouse');
    
    if (!spouseHasSolo401k) {
      opportunities.push({
        account: 'Spouse Solo 401(k)',
        maxContribution: spouseTotalMax,
        recommendedContribution: Math.min(spouseTotalMax, annualCashFlow * 0.2),
        owner: 'spouse',
        priority: 1,
        impact: 'Very High',
        description: `Your spouse can open a Solo 401(k) and contribute up to $${spouseTotalMax.toLocaleString()}/year.`
      });
    }
  }
  
  // Increase existing 401(k) contributions
  if (has401k && currentContributions < regularLimit401k && annualCashFlow > 10000) {
    const additionalRoom = regularLimit401k - currentContributions;
    opportunities.push({
      account: '401(k) Increase',
      maxContribution: additionalRoom,
      recommendedContribution: Math.min(additionalRoom, annualCashFlow * 0.2),
      owner: 'user',
      priority: 2,
      impact: 'High',
      description: `Increase 401(k) contributions by $${Math.min(additionalRoom, annualCashFlow * 0.2).toLocaleString()}/year. You have $${additionalRoom.toLocaleString()} in additional contribution room.`
    });
  }
  
  return opportunities;
}

// Generate retirement optimization suggestions using Gemini AI
async function generateRetirementOptimizationSuggestions(
  profile: any,
  currentResult: any,
  optimalAges: {
    userOptimalSSAge: number;
    spouseOptimalSSAge: number;
    currentAge: number;
    spouseAge: number;
  }
): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const userRiskProfile = profile.riskQuestions?.[0] || 3;
  const spouseRiskProfile = profile.spouseRiskQuestions?.[0] || 3;
  const riskProfileMap = {
    1: "Conservative",
    2: "Moderately Conservative", 
    3: "Moderate",
    4: "Moderately Aggressive",
    5: "Aggressive"
  };

  const monthlyContributions = ((profile.retirementContributions?.employee || 0) + (profile.retirementContributions?.employer || 0) + 
    (profile.spouseRetirementContributions?.employee || 0) + (profile.spouseRetirementContributions?.employer || 0)) / 12;
  
  // Calculate monthly cash flow
  const monthlyIncome = ((profile.annualIncome || 0) + (profile.spouseAnnualIncome || 0)) / 12;
  const monthlyExpenses = profile.expectedMonthlyExpensesRetirement || 8000;
  const monthlyCashFlow = monthlyIncome - monthlyExpenses - monthlyContributions;
  
  // Analyze retirement contribution opportunities
  const metrics = { monthlyCashFlow };
  const contributionOpportunities = analyzeRetirementContributionOpportunities(profile, metrics);
  
  // Check for LTC insurance
  const hasLTC = profile.hasLongTermCareInsurance;
  const spouseHasLTC = profile.spouseHasLongTermCareInsurance;
    
  const prompt = `As a financial advisor, analyze this retirement plan and provide EXACTLY 5 optimization suggestions.

Current Retirement Confidence Score: ${currentResult?.probabilityOfSuccess ? currentResult.probabilityOfSuccess.toFixed(1) : '0.0'}%
User Age: ${optimalAges.currentAge}, Spouse Age: ${optimalAges.spouseAge}
Current Retirement Ages: User ${profile.desiredRetirementAge || 65}, Spouse ${profile.spouseDesiredRetirementAge || 65}
Current SS Claim Strategy: ${profile.socialSecurityClaimAge ? 'User-defined' : 'Not optimized'}
SS Optimization Available: Yes (requires retirement variable optimization first)
Risk Profiles: User ${riskProfileMap[userRiskProfile]}, Spouse ${riskProfileMap[spouseRiskProfile]}
Investment Strategy: ${profile.expectedRealReturn === -1 ? 'Glide Path' : `${profile.expectedRealReturn}% Fixed Return`}
Monthly Retirement Contributions: $${monthlyContributions}
Expected Monthly Expenses: $${profile.expectedMonthlyExpensesRetirement || 8000}
Annual Income: $${profile.annualIncome || 0}
Spouse Annual Income: $${profile.spouseAnnualIncome || 0}
Monthly Cash Flow Available: $${monthlyCashFlow.toFixed(0)}
Has Long-Term Care Insurance: ${hasLTC ? 'Yes' : 'No'}
Spouse Has LTC Insurance: ${spouseHasLTC ? 'Yes' : 'No'}

Retirement Account Opportunities Found: ${contributionOpportunities.length}
${contributionOpportunities.map(o => `- ${o.account}: up to $${o.maxContribution}/year`).join('\n')}

PRIORITY ORDER (MUST follow this):
1. Long-term care insurance (if not covered)
2. Maximize 401(k) retirement contributions (if cash flow available)
3. Contribute to Traditional or Roth IRA (if room based on cash flow)
4. Consider delaying retirement (if below 80% confidence)
5. Reduce monthly planned expenses in retirement
6. Optimize Social Security claiming strategy
7. Consider part-time work in retirement

Return EXACTLY 5 suggestions in this format:
1. [Action Item] | +X.X% expected improvement
2. [Action Item] | +X.X% expected improvement
3. [Action Item] | +X.X% expected improvement
4. [Action Item] | +X.X% expected improvement
5. [Action Item] | +X.X% expected improvement

Rules:
- Each action item must be ONE SHORT LINE (max 12 words)
- Be SPECIFIC with numbers (e.g., "Open Traditional IRA, contribute $7,000/year")
- Rank by the PRIORITY ORDER above, not just by impact
- Include realistic improvement estimates based on the action
- If LTC insurance missing, it MUST be first recommendation
- If cash flow positive and 401(k) available, MUST recommend it before IRA
- If cash flow allows IRA after 401(k), recommend Traditional or Roth IRA
- Consider delaying retirement if below 80% confidence score
- Include part-time work option if struggling to reach goals
- NEVER mention specific ages for Social Security claiming (no "age 67", "age 70", etc.)
- For Social Security, only say "Optimize Social Security claiming strategy"`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating optimization suggestions:', error);
    // Return structured fallback suggestions following priority order
    const fallbackSuggestions = [];
    
    // Priority 1: LTC Insurance
    if (!hasLTC || !spouseHasLTC) {
      const who = !hasLTC && !spouseHasLTC ? 'both spouses' : !hasLTC ? 'user' : 'spouse';
      fallbackSuggestions.push(`1. Get long-term care insurance for ${who} | +6.5% expected improvement`);
    }
    
    // Priority 2: Maximize 401(k) contributions
    const has401k = contributionOpportunities.find(o => o.account.includes('401(k)'));
    if (has401k && monthlyCashFlow > 500) {
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Maximize 401(k): contribute $${has401k.recommendedContribution.toLocaleString()}/year | +5.2% expected improvement`);
    }
    
    // Priority 3: IRA contributions
    const hasIRA = contributionOpportunities.find(o => o.account.includes('IRA'));
    if (hasIRA && monthlyCashFlow > 300) {
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. ${hasIRA.account}: contribute $${hasIRA.recommendedContribution.toLocaleString()}/year | +3.8% expected improvement`);
    }
    
    // Priority 4: Delay retirement
    if (currentResult.probabilityOfSuccess < 80) {
      const yearsToDelay = currentResult.probabilityOfSuccess < 60 ? 3 : 2;
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Delay retirement by ${yearsToDelay} years | +${yearsToDelay === 3 ? '10.5' : '8.3'}% expected improvement`);
    }
    
    // Priority 5: Reduce monthly expenses
    if (profile.expectedMonthlyExpensesRetirement > 6000) {
      const reduction = Math.min(1000, Math.round(profile.expectedMonthlyExpensesRetirement * 0.1));
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Reduce retirement expenses by $${reduction}/month | +3.2% expected improvement`);
    }
    
    // Priority 6: SS optimization
    if (!profile.socialSecurityClaimAge || profile.socialSecurityClaimAge < 70) {
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Optimize Social Security claiming strategy | +4.8% expected improvement`);
    }
    
    // Priority 7: Part-time work
    if (currentResult.probabilityOfSuccess < 75 && fallbackSuggestions.length < 5) {
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Consider part-time work in retirement | +4.5% expected improvement`);
    }
    
    // Fill remaining slots with other recommendations if needed
    if (fallbackSuggestions.length < 5 && monthlyContributions < 2000) {
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Increase monthly contributions by $${Math.min(1000, Math.round((profile.annualIncome || 0) * 0.05 / 12))} | +3.1% expected improvement`);
    }
    
    while (fallbackSuggestions.length < 5) {
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Review estate planning documents | +0.5% expected improvement`);
    }
    
    return fallbackSuggestions.slice(0, 5).join('\n');
  }
}

// Check if Step 11 (Retirement Planning) has minimum required fields for optimal retirement age calculation
function isStep11SufficientForOptimalAge(profileData: any): boolean {
  const hasDesiredRetirementAge = !!profileData.desiredRetirementAge;
  const hasRetirementExpenses = !!(profileData.expectedMonthlyExpensesRetirement || profileData.monthlyExpenses);
  const hasSocialSecurity = !!(profileData.socialSecurityBenefit || profileData.estimatedAnnualSocialSecurity);
  
  // Log what we found for debugging
  console.log('Step 11 completion check:', {
    hasDesiredRetirementAge,
    hasRetirementExpenses,
    hasSocialSecurity,
    desiredRetirementAge: profileData.desiredRetirementAge,
    expectedMonthlyExpensesRetirement: profileData.expectedMonthlyExpensesRetirement,
    socialSecurityBenefit: profileData.socialSecurityBenefit
  });
  
  return hasDesiredRetirementAge && hasRetirementExpenses && hasSocialSecurity;
}

// Find optimal retirement age for achieving >= 80% success probability
async function findOptimalRetirementAge(
  profileData: any,
  targetSuccessRate: number = 80
): Promise<{
  currentAge: number;
  desiredAge: number;
  optimalAge: number | null;
  canRetireEarlier: boolean;
  earliestAge: number | null;
  currentProbability: number;
  optimalProbability: number | null;
  message: string;
} | null> {
  try {
    // Get base parameters
    const baseParams = profileToRetirementParams(profileData);
    const currentAge = baseParams.currentAge;
    const desiredAge = baseParams.retirementAge;
    const spouseAge = baseParams.spouseAge;
    const spouseRetirementAge = baseParams.spouseRetirementAge || desiredAge;
    
    // Run simulation for desired retirement age first (enhanced engine)
    const mcDesiredResult = await mcPool.run({ params: baseParams, simulationCount: 300, type: 'score' });
    const desiredResult = mcDesiredResult.fullResult;
    const currentProbability = desiredResult?.probabilityOfSuccess || 0;
    
    // If already meeting target, check if can retire earlier
    if (currentProbability >= targetSuccessRate / 100) {
      let earliestAge = desiredAge;
      
      // Check earlier retirement ages (go back up to 5 years)
      for (let age = desiredAge - 1; age >= Math.max(currentAge + 1, desiredAge - 5, 55); age--) {
        const earlierParams = { ...baseParams, retirementAge: age };
        
        // Adjust spouse retirement age proportionally if applicable
        if (spouseAge && spouseRetirementAge) {
          const ageDiff = desiredAge - age;
          earlierParams.spouseRetirementAge = Math.max(spouseAge + 1, spouseRetirementAge - ageDiff);
        }
        
        const mcEarlierResult = await mcPool.run({ params: earlierParams, simulationCount: 300, type: 'score' });
        const earlierResult = mcEarlierResult.fullResult;
        if ((earlierResult?.probabilityOfSuccess || 0) >= targetSuccessRate / 100) {
          earliestAge = age;
        } else {
          break; // Stop when we find the earliest viable age
        }
      }
      
      const message = earliestAge < desiredAge 
        ? `Great news! You can retire ${desiredAge - earliestAge} year${desiredAge - earliestAge > 1 ? 's' : ''} earlier at age ${earliestAge} with ${targetSuccessRate}%+ confidence.`
        : `You're on track to retire at your desired age of ${desiredAge} with ${Math.round(currentProbability * 100)}% confidence.`;
      
      return {
        currentAge,
        desiredAge,
        optimalAge: desiredAge,
        canRetireEarlier: earliestAge < desiredAge,
        earliestAge: earliestAge < desiredAge ? earliestAge : null,
        currentProbability,
        optimalProbability: currentProbability,
        message
      };
    }
    
    // Need to find later retirement age for target success
    let optimalAge: number | null = null;
    let optimalProbability: number | null = null;
    const maxAge = Math.min(75, currentAge + 30); // Don't go beyond 75 or 30 years from now
    
    for (let age = desiredAge + 1; age <= maxAge; age++) {
      const laterParams = { ...baseParams, retirementAge: age };
      
      // Adjust spouse retirement age proportionally if applicable
      if (spouseAge && spouseRetirementAge) {
        const ageDiff = age - desiredAge;
        laterParams.spouseRetirementAge = Math.min(75, spouseRetirementAge + ageDiff);
      }
      
      const mcLaterResult = await mcPool.run({ params: laterParams, simulationCount: 300, type: 'score' });
      const laterResult = mcLaterResult.fullResult;
      if ((laterResult?.probabilityOfSuccess || 0) >= targetSuccessRate / 100) {
        optimalAge = age;
        optimalProbability = laterResult?.probabilityOfSuccess || 0;
        break;
      }
    }
    
    // Generate appropriate message
    let message: string;
    if (optimalAge) {
      const yearsToDelay = optimalAge - desiredAge;
      message = `You're not quite ready to retire at ${desiredAge} (${Math.round(currentProbability * 100)}% confidence). Consider delaying retirement by ${yearsToDelay} year${yearsToDelay > 1 ? 's' : ''} to age ${optimalAge} for ${targetSuccessRate}%+ confidence.`;
    } else {
      message = `Your current plan shows ${Math.round(currentProbability * 100)}% confidence at age ${desiredAge}. Significant changes are needed to achieve ${targetSuccessRate}% confidence. Consider increasing savings, reducing expenses, or working with a financial advisor.`;
    }
    
    return {
      currentAge,
      desiredAge,
      optimalAge,
      canRetireEarlier: false,
      earliestAge: null,
      currentProbability,
      optimalProbability,
      message
    };
  } catch (error) {
    console.error('Error calculating optimal retirement age:', error);
    return null;
  }
}

// Calculate loan repayment details
function calculateLoanRepayment(totalLoanAmount: number, goal: EducationGoal): any {
  // Default to 10% interest rate for Parent PLUS loans if not specified
  const interestRate = parseFloat(goal.loanInterestRate?.toString() || '10') / 100;
  const repaymentYears = parseFloat(goal.loanRepaymentTerm?.toString() || '10');
  
  if (totalLoanAmount === 0) {
    return {
      monthlyPayment: 0,
      totalInterest: 0,
      totalRepayment: 0,
      repaymentYears: 0
    };
  }
  
  // Calculate monthly payment using loan amortization formula
  const monthlyRate = interestRate / 12;
  const numPayments = repaymentYears * 12;
  
  const monthlyPayment = totalLoanAmount * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const totalRepayment = monthlyPayment * numPayments;
  const totalInterest = totalRepayment - totalLoanAmount;
  
  return {
    monthlyPayment: Math.round(monthlyPayment),
    totalInterest: Math.round(totalInterest),
    totalRepayment: Math.round(totalRepayment),
    repaymentYears,
    interestRate: interestRate * 100,
    effectiveCostWithLoans: Math.round(totalLoanAmount + totalInterest)
  };
}

// Check if family can afford loan payments based on cash flow
function checkLoanAffordability(loanDetails: any, profile: FinancialProfile | null): boolean {
  if (!loanDetails || loanDetails.monthlyPayment === 0) {
    return true; // No loans needed
  }
  
  if (!profile) {
    return false; // Cannot determine affordability without profile
  }
  
  // Calculate monthly cash flow
  const monthlyIncome = (parseFloat(profile.annualIncome?.toString() || '0') + 
                        parseFloat(profile.spouseAnnualIncome?.toString() || '0')) / 12;
  
  // Get total monthly expenses from the JSON object
  let totalMonthlyExpenses = 0;
  if (profile.monthlyExpenses && typeof profile.monthlyExpenses === 'object') {
    // Sum up all expense categories
    totalMonthlyExpenses = Object.values(profile.monthlyExpenses as Record<string, number>)
      .reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
  }
  
  const monthlyCashFlow = monthlyIncome - totalMonthlyExpenses;
  
  // Check if loan payment is less than 20% of monthly cash flow (conservative threshold)
  const affordabilityRatio = monthlyCashFlow > 0 ? loanDetails.monthlyPayment / monthlyCashFlow : 1;
  
  // Estimate existing debt from liabilities
  let existingMonthlyDebt = 0;
  if (profile.liabilities && Array.isArray(profile.liabilities)) {
    // Estimate monthly payments from liabilities (rough approximation)
    existingMonthlyDebt = (profile.liabilities as any[])
      .filter(l => l.type === 'mortgage' || l.type === 'auto_loan' || l.type === 'personal_loan')
      .reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  }
  
  const totalDebtPayments = existingMonthlyDebt + loanDetails.monthlyPayment;
  const debtToIncomeRatio = monthlyIncome > 0 ? totalDebtPayments / monthlyIncome : 1;
  
  return affordabilityRatio <= 0.20 && debtToIncomeRatio <= 0.43; // Standard DTI threshold
}

// Calculate education scenario with what-if variables
async function calculateEducationScenario(variables: {
  goalId: number;
  userId: number;
  annualCost?: number;
  inflationRate?: number;
  scholarships?: number;
  monthlyContribution?: number;
  expectedReturn?: number;
  currentSavings?: number;
}): Promise<{
  totalCost: number;
  totalFunded: number;
  fundingPercentage: number;
  monthlyContributionNeeded: number;
  fundingGap: number;
  years: number[];
  costs: number[];
  funded: number[];
  loanAmounts: number[];
}> {
  const { goalId, userId } = variables;
  
  // Get the actual goal data from database
  const goal = await storage.getEducationGoal(userId, goalId);
  if (!goal) {
    throw new Error("Education goal not found");
  }

  // Apply what-if variables, falling back to goal data
  const modifiedGoal = {
    ...goal,
    costPerYear: (variables.annualCost || goal.costPerYear)?.toString() || null,
    inflationRate: (variables.inflationRate || goal.inflationRate)?.toString() || null,
    scholarshipPerYear: (variables.scholarships || goal.scholarshipPerYear)?.toString() || null,
    monthlyContribution: (variables.monthlyContribution || goal.monthlyContribution)?.toString() || null,
    expectedReturn: (variables.expectedReturn || goal.expectedReturn)?.toString() || null,
    currentSavings: (variables.currentSavings || goal.currentSavings)?.toString() || null
  };

  // Use the existing calculateEducationProjection function with modified goal
  const projection = await calculateEducationProjection(modifiedGoal, userId);
  
  return {
    totalCost: projection.totalCost,
    totalFunded: projection.totalFunded,
    fundingPercentage: projection.fundingPercentage,
    monthlyContributionNeeded: projection.monthlyContributionNeeded,
    fundingGap: Math.max(0, projection.totalCost - projection.totalFunded),
    years: projection.years,
    costs: projection.costs,
    funded: projection.funded,
    loanAmounts: projection.loanAmounts || []
  };
}

// Calculate education funding projection with Monte Carlo simulation
async function calculateEducationProjection(goal: EducationGoal, userId: number): Promise<any> {
  const profile = await storage.getFinancialProfile(userId);
  
  // Get Plaid 529 account data
  const plaid529Accounts = await PlaidDataAggregator.get529Accounts(userId);
  
  // Enhance goal with Plaid 529 data if available
  let enhancedGoal = { ...goal };
  if (plaid529Accounts.length > 0) {
    // If we have Plaid 529 accounts, use their total balance as current savings
    const total529Balance = plaid529Accounts.reduce((sum, account) => sum + (account.current || 0), 0);
    
    // Only update if Plaid balance is higher (user might have manually entered a higher value)
    if (total529Balance > parseFloat(goal.currentSavings?.toString() || '0')) {
      enhancedGoal.currentSavings = total529Balance;
    }
    
    // Try to detect monthly contributions from recent transactions
    const monthlyContributions = await PlaidDataAggregator.detect529Contributions(userId);
    if (monthlyContributions > 0 && monthlyContributions > parseFloat(goal.monthlyContribution?.toString() || '0')) {
      enhancedGoal.monthlyContribution = monthlyContributions;
    }
  }
  
  // Include saved extra-year probability from the latest saved optimization (if any)
  try {
    let scenarios: Awaited<ReturnType<typeof storage.getEducationScenariosByGoal>> = [];
    try {
      scenarios = await storage.getEducationScenariosByGoal(userId, (enhancedGoal as any).id);
    } catch (scenarioError) {
      if (!isMissingEducationScenarioTable(scenarioError)) {
        throw scenarioError;
      }
    }
    const savedScenario = (scenarios || []).slice().reverse().find((s) => s.scenarioType === "optimization_engine_saved");
    const savedExtra = typeof (savedScenario as any)?.parameters?.extraYearProbability === 'number'
      ? (savedScenario as any).parameters.extraYearProbability
      : null;
    if (savedExtra != null) {
      (enhancedGoal as any).extraYearProbability = savedExtra;
    }
  } catch {}

  // Use Monte Carlo enhanced projection
  const monteCarloProjection = await calculateEducationProjectionWithMonteCarlo(enhancedGoal as any, profile);
  
  // Also calculate traditional projection for backward compatibility
  const inflationRate = parseFloat(enhancedGoal.inflationRate?.toString() || '2.4') / 100;
  const expectedReturn = parseFloat(enhancedGoal.expectedReturn?.toString() || '6') / 100;
  const currentYear = new Date().getFullYear();
  
  const years: number[] = [];
  const costs: number[] = [];
  const funded: number[] = [];
  const loanAmounts: number[] = [];
  
  let baseCost = 0;
  
  // Determine base annual cost
  if (enhancedGoal.costPerYear) {
    // Always use the costPerYear if it's set (whether from custom, specific college, or national average selection)
    baseCost = parseFloat(enhancedGoal.costPerYear.toString());
  } else {
    // Fallback only if costPerYear is not set
    baseCost = enhancedGoal.goalType === 'college' ? 35000 : 15000; // College vs Pre-K-12
  }
  
  // Use the values that were already processed and aggregated by the frontend
  const scholarshipPerYear = parseFloat(enhancedGoal.scholarshipPerYear?.toString() || '0');
  const loanPerYear = parseFloat(enhancedGoal.loanPerYear?.toString() || '0');
  
  const coverPercent = parseFloat(enhancedGoal.coverPercent?.toString() || '100') / 100;
  
  let totalCost = 0;
  let totalFunded = 0;
  let totalLoans = 0;
  
  // Current savings and growth - now using enhanced goal data with Plaid
  let currentSavings = parseFloat(enhancedGoal.currentSavings?.toString() || '0');
  // monthlyContribution already includes all funding sources if they were properly aggregated
  const monthlyContribution = parseFloat(enhancedGoal.monthlyContribution?.toString() || '0');
  const yearsUntilStart = enhancedGoal.startYear - currentYear;
  
  // Grow current savings and contributions until start year
  if (yearsUntilStart > 0) {
    // Use glide path projection if available, otherwise use traditional calculation
    if (enhancedGoal.riskProfile === 'glide' && monteCarloProjection.glidePathProjection) {
      // Use the final balance from glide path projection
      currentSavings = monteCarloProjection.glidePathProjection.finalBalance;
    } else {
      // Traditional calculation with fixed return rate
      // Future value of current savings
      currentSavings = currentSavings * Math.pow(1 + expectedReturn, yearsUntilStart);
      
      // Future value of monthly contributions (annuity)
      if (monthlyContribution > 0) {
        const monthlyReturn = expectedReturn / 12;
        const monthsUntilStart = yearsUntilStart * 12;
        currentSavings += monthlyContribution * ((Math.pow(1 + monthlyReturn, monthsUntilStart) - 1) / monthlyReturn);
      }
    }
  }
  
  // Method 3: Dynamic Growth and Withdrawal
  // This method correctly accounts for investment growth during the withdrawal phase
  
  // Calculate costs and funding for each year
  // Use enhancedGoal.years to iterate exactly the specified number of years
  for (let i = 0; i < enhancedGoal.years; i++) {
    const year = enhancedGoal.startYear + i;
    const yearsFromNow = year - currentYear;
    const inflatedCost = baseCost * Math.pow(1 + inflationRate, yearsFromNow);
    const netCost = (inflatedCost - scholarshipPerYear) * coverPercent;
    
    years.push(year);
    costs.push(Math.round(netCost));
    
    // At the beginning of each school year:
    // 1. First, withdraw the funds needed for this year
    const fundedFromSavings = Math.min(currentSavings, netCost);
    funded.push(Math.round(fundedFromSavings));
    currentSavings -= fundedFromSavings;
    
    // 2. Calculate loan amount for this year if needed
    const remainingCost = netCost - fundedFromSavings;
    const loanForYear = Math.min(loanPerYear, remainingCost);
    loanAmounts.push(Math.round(loanForYear));
    
    // 3. After withdrawal, apply growth to remaining balance for the rest of the year
    // This represents the reality that remaining funds continue to grow
    if (currentSavings > 0) {
      currentSavings *= (1 + expectedReturn);
    }
    
    // 4. Add monthly contributions made during this education year
    // These contributions also earn returns as they're added throughout the year
    if (monthlyContribution > 0) {
      // Use the average time in account (6 months) for contributions made during the year
      const avgMonthsInvested = 6;
      const partialYearReturn = expectedReturn * (avgMonthsInvested / 12);
      const contributionsThisYear = monthlyContribution * 12 * (1 + partialYearReturn);
      currentSavings += contributionsThisYear;
    }
    
    totalCost += netCost;
    totalFunded += fundedFromSavings;
    totalLoans += loanForYear;
  }
  
  // Calculate loan repayment details
  const loanDetails = calculateLoanRepayment(totalLoans, goal);
  
  // Calculate comprehensive funding percentage including loans
  const totalFundingWithLoans = totalFunded + totalLoans;
  const fundingPercentage = totalCost > 0 ? (totalFunded / totalCost) * 100 : 0;
  const comprehensiveFundingPercentage = totalCost > 0 ? (totalFundingWithLoans / totalCost) * 100 : 0;
  
  // Check if family can afford loan payments based on cash flow
  const canAffordLoans = profile ? checkLoanAffordability(loanDetails, profile) : false;
  
  // Return combined results
  return {
    years,
    costs,
    funded,
    loanAmounts,
    totalCost: Math.round(totalCost),
    totalFunded: Math.round(totalFunded),
    totalLoans: Math.round(totalLoans),
    fundingPercentage: Math.round(fundingPercentage),
    comprehensiveFundingPercentage: Math.round(comprehensiveFundingPercentage),
    loanDetails,
    canAffordLoans,
    monthlyContributionNeeded: monteCarloProjection.monthlyContributionNeeded,
    probabilityOfSuccess: monteCarloProjection.probabilityOfSuccess,
    monteCarloAnalysis: monteCarloProjection.monteCarloAnalysis,
    glidePathProjection: monteCarloProjection.glidePathProjection
  };
}

// Generate education funding recommendations using Gemini
async function generateEducationRecommendations(
  goal: EducationGoal, 
  projection: any, 
  profile: FinancialProfile | null
): Promise<string> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return "AI recommendations unavailable. Please configure Gemini API.";
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });
    
    const userState = goal.stateOfResidence || profile?.state || 'CA';
    const retirementOnTrack = true; // Simplified - would calculate from profile
    
    const prompt = `
    The client is planning for ${goal.studentName}'s education. 
    Goal: ${goal.goalType === 'college' ? 'College' : 'Pre-K-12 Education'}, ${goal.years} years starting ${goal.startYear}. 
    Projected total cost in future dollars: $${projection.totalCost.toLocaleString()}.
    They currently have $${projection.totalFunded.toLocaleString()} funded, covering ${projection.fundingPercentage}% of costs.
    ${projection.totalLoans ? `They plan to use $${projection.totalLoans.toLocaleString()} in loans.` : ''}
    ${projection.comprehensiveFundingPercentage ? `With loans, ${projection.comprehensiveFundingPercentage}% of costs are covered.` : ''}
    They live in ${userState}. 
    
    ${projection.loanDetails && projection.loanDetails.monthlyPayment > 0 ? `
    Loan Analysis:
    - Total loans needed: $${projection.totalLoans.toLocaleString()}
    - Monthly loan payment (10 years): $${projection.loanDetails.monthlyPayment.toLocaleString()}
    - Total interest cost: $${projection.loanDetails.totalInterest.toLocaleString()}
    - Can afford loan payments: ${projection.canAffordLoans ? 'Yes' : 'No'}
    ` : ''}
    
    ${profile ? `
    Family Financial Context:
    - Annual household income: $${((profile.annualIncome || 0) + (profile.spouseAnnualIncome || 0)).toLocaleString()}
    - Net worth: $${profile.netWorth?.toLocaleString() || 'Not calculated'}
    - Cash flow situation: ${profile.monthlyCashFlow > 0 ? 'Positive' : 'Negative'}
    ` : ''}
    
    Provide specific, actionable advice on:
    - Optimal funding strategy considering their high income and ability to take loans
    - Whether to prioritize saving in 529 plans vs using loans strategically
    - Tax implications of different funding approaches in ${userState}
    - How to balance immediate cash flow needs with long-term costs
    - Strategies to minimize total cost (including loan interest)
    - Alternative funding options for high-net-worth families
    
    Consider that high-income families may benefit from:
    - Using loans to preserve liquidity and investment opportunities
    - Tax advantages of 529 plans even if not needed for funding
    - Strategic timing of withdrawals and loan repayments
    
    Make the advice clear, specific, and actionable. Use bullet points for easy reading.
    End with a brief disclaimer that this is general educational information, not personalized financial advice.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating education recommendations:', error);
    return `Based on our analysis:
    
• To fully fund this education goal, save approximately $${projection.monthlyContributionNeeded.toLocaleString()} per month
• Consider using a 529 plan for tax-free growth and potential state tax benefits
• Current funding: ${projection.fundingPercentage}% of projected costs
• Apply for scholarships and financial aid to reduce out-of-pocket costs
• Don't sacrifice retirement savings - there are loans for college but not for retirement

This is general educational information. Consult a financial advisor for personalized advice.`;
  }
}

// Generate structured education recommendations for display
async function generateStructuredEducationRecommendations(goals: any[], profile: any): Promise<any[]> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    // For structured recommendations, use the first goal's state or profile state
    const userState = goals[0]?.stateOfResidence || profile?.state || 'CA';
    
    // Calculate aggregate statistics
    const totalCost = goals.reduce((sum, goal) => sum + (goal.projection?.totalCost || 0), 0);
    const totalFunded = goals.reduce((sum, goal) => sum + (goal.projection?.totalFunded || 0), 0);
    const totalMonthlyNeeded = goals.reduce((sum, goal) => sum + (goal.projection?.monthlyContributionNeeded || 0), 0);
    const fundingPercentage = totalCost > 0 ? Math.round((totalFunded / totalCost) * 100) : 0;
    
    // Build goal summary
    const goalsSummary = goals.map(goal => 
      `- ${goal.studentName} (${goal.goalType === 'college' ? 'College' : 'Pre-K-12'}): ` +
      `${goal.startYear}-${goal.endYear}, $${goal.projection?.totalCost.toLocaleString()} total cost, ` +
      `${goal.projection?.fundingPercentage}% funded`
    ).join('\n');
    
    const prompt = `
    Analyze the following education funding goals and provide EXACTLY 5 actionable recommendations.
    
    Education Goals:
    ${goalsSummary}
    
    Total projected cost: $${totalCost.toLocaleString()}
    Currently funded: $${totalFunded.toLocaleString()} (${fundingPercentage}% of total)
    Monthly savings needed: $${totalMonthlyNeeded.toLocaleString()}
    State: ${userState}
    
    Return a JSON array with EXACTLY 5 recommendations, ranked from most important (priority 1) to least important (priority 5).
    Each recommendation should have this structure:
    {
      "title": "Brief title (max 60 chars)",
      "description": "Detailed explanation and why this matters (150-200 chars)",
      "category": "One of: savings strategy, tax planning, financial aid, investment strategy, funding sources",
      "priority": 1-5 (1 being most important),
      "actionSteps": ["Step 1", "Step 2", "Step 3"] (2-3 specific action steps)
    }
    
    Focus on:
    1. If underfunded: Increasing savings or finding alternative funding
    2. Tax-advantaged accounts (529 plans with ${userState} benefits)
    3. Financial aid optimization
    4. Investment allocation based on time horizon
    5. Scholarship and grant opportunities
    
    IMPORTANT: Return ONLY valid JSON array, no additional text.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON response
    try {
      const recommendations = JSON.parse(text);
      return Array.isArray(recommendations) ? recommendations.slice(0, 5) : [];
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      // Return default recommendations if parsing fails
      return generateDefaultEducationRecommendations(goals, fundingPercentage, totalMonthlyNeeded, userState);
    }
  } catch (error) {
    console.error('Error generating structured recommendations:', error);
    return generateDefaultEducationRecommendations(goals, 0, 0, 'CA');
  }
}

// Default recommendations if AI fails
function generateDefaultEducationRecommendations(goals: any[], fundingPercentage: number, monthlyNeeded: number, state: string): any[] {
  const recommendations = [];
  
  if (fundingPercentage < 50) {
    recommendations.push({
      title: "Increase Monthly Education Savings",
      description: `You're only ${fundingPercentage}% funded. Consider increasing monthly contributions by $${Math.round(monthlyNeeded * 0.5)} to improve funding status.`,
      category: "savings strategy",
      priority: 1,
      actionSteps: [
        "Set up automatic monthly transfers to education savings",
        "Review budget to find additional savings opportunities",
        "Consider increasing contributions with annual raises"
      ]
    });
  }
  
  recommendations.push({
    title: `Open ${state} 529 Plan Account`,
    description: `Take advantage of state tax deductions and tax-free growth for education expenses.`,
    category: "tax planning",
    priority: 2,
    actionSteps: [
      `Research ${state} 529 plan benefits and tax deductions`,
      "Compare investment options and fees",
      "Set up automatic contributions from checking account"
    ]
  });
  
  recommendations.push({
    title: "Optimize Financial Aid Strategy",
    description: "Position assets and income to maximize potential financial aid eligibility.",
    category: "financial aid",
    priority: 3,
    actionSteps: [
      "Understand how 529 plans affect financial aid calculations",
      "Consider asset ownership strategies",
      "Plan income timing in years before college"
    ]
  });
  
  recommendations.push({
    title: "Review Investment Allocation",
    description: "Ensure investment mix matches time horizon for each education goal.",
    category: "investment strategy",
    priority: 4,
    actionSteps: [
      "Use age-based investment options for younger children",
      "Shift to conservative allocation as college approaches",
      "Review and rebalance annually"
    ]
  });
  
  recommendations.push({
    title: "Research Scholarships and Grants",
    description: "Reduce education costs through merit and need-based aid opportunities.",
    category: "funding sources",
    priority: 5,
    actionSteps: [
      "Start scholarship search 2 years before college",
      "Focus on local and specialized scholarships",
      "Maintain strong academic performance for merit aid"
    ]
  });
  
  return recommendations;
}

// Generate personalized recommendations for a specific education goal
async function generatePersonalizedGoalRecommendations(
  goal: any,
  profile: FinancialProfile | null,
  savedScenario?: any
): Promise<any[]> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return generateDefaultPersonalizedRecommendations(goal, profile);
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });
    
    const userState = goal.stateOfResidence || profile?.state || 'CA';
    const currentYear = new Date().getFullYear();
    const yearsUntilStart = goal.startYear - currentYear;
    const fundingGap = goal.projection.totalCost - goal.projection.totalFunded;
    const monthlyIncreaseNeeded = goal.projection.monthlyContributionNeeded - (goal.monthlyContribution || 0);

    const baselineSuccess = savedScenario?.results?.baselineProbabilityOfSuccess ?? null;
    const optimizedSuccess = savedScenario?.results?.optimizedProbabilityOfSuccess ?? goal.projection.probabilityOfSuccess ?? null;
    const optimizerVariables = savedScenario?.parameters ?? {};

    const optimizationContext = savedScenario ? `

Optimization Engine (saved plan):
- Baseline Monte Carlo success probability: ${baselineSuccess ?? 'N/A'}%
- Optimized Monte Carlo success probability: ${optimizedSuccess ?? 'N/A'}%
- Selected variables:
  • Monthly 529 contribution: ${optimizerVariables.monthlyContribution ?? 'N/A'}
  • Annual scholarships: ${optimizerVariables.annualScholarships ?? 'N/A'}
  • Loan per year: ${optimizerVariables.loanPerYear ?? 'N/A'}
  • Tuition inflation assumption: ${optimizerVariables.tuitionInflationRate ?? 'N/A'}
  • Investment strategy: ${optimizerVariables.investmentStrategy ?? 'N/A'}
  • Extra year probability: ${optimizerVariables.extraYearProbability ?? 'N/A'}
` : '';

    const prompt = `
You are an expert CFP. Think hard before you answer.

Analyze this specific education goal and provide 5–7 highly personalized recommendations, returned ONLY as JSON.

Student Information:
- Name: ${goal.studentName}
- Relationship: ${goal.relationship || 'child'}
- Education Type: ${goal.goalType === 'college' ? 'College' : 'Pre-K-12'}
- Years: ${goal.startYear} to ${goal.endYear} (${goal.years} years)
${goal.collegeName ? `- School: ${goal.collegeName}` : ''}

Financial Details:
- Total Projected Cost: $${goal.projection.totalCost.toLocaleString()}
- Annual Cost: $${(goal.costPerYear || 0).toLocaleString()}
- Currently Funded: $${goal.projection.totalFunded.toLocaleString()} (${goal.projection.fundingPercentage}%)
- Funding Gap: $${fundingGap.toLocaleString()}
- Current Monthly Savings: $${(goal.monthlyContribution || 0).toLocaleString()}
- Monthly Savings Needed: $${goal.projection.monthlyContributionNeeded.toLocaleString()} (${monthlyIncreaseNeeded > 0 ? `increase of $${monthlyIncreaseNeeded.toLocaleString()}` : 'no increase required'})
- Probability of Success (current projection): ${goal.projection.probabilityOfSuccess}%
- Years Until Start: ${yearsUntilStart}
- Expected Return: ${goal.expectedReturn}%
- Risk Profile: ${goal.riskProfile || 'moderate'}
- Scholarships/Grants: $${(goal.scholarshipPerYear || 0).toLocaleString()}/year
- Account Type: ${goal.accountType || '529'}
${optimizationContext}

Household Context:
- State of Residence: ${userState}
- Annual Income: $${(profile?.annualIncome || 0).toLocaleString()}
${profile?.spouseAnnualIncome ? `- Spouse Income: $${profile.spouseAnnualIncome.toLocaleString()}` : ''}

Return a JSON array of 5–7 recommendations, ranked by priority (1 = highest). Each item must follow:
{
  "title": "Short, actionable title",
  "description": "150–220 chars, specific to ${goal.studentName}",
  "category": "One of: savings strategy, tax planning, financial aid, investment strategy, funding sources, risk management",
  "priority": 1-5 (1 = most urgent),
  "impact": "Brief expected impact (e.g., +$${Math.max(0, Math.round(monthlyIncreaseNeeded))}/mo savings; +10% success)",
  "actionSteps": ["Step 1", "Step 2", "Step 3"] // 3-5 specific actions with dollar amounts or deadlines where applicable
}

Prioritize based on:
1. Critical funding gaps and time horizon
2. High-impact levers (tax savings, scholarships, cash flow adjustments)
3. Time-sensitive actions (deadlines, application windows)
4. Quick wins vs. structural changes
5. Risk management and contingency planning

Be explicit about:
- Dollar changes for savings/investments or scholarships
- Timing (immediate, next 6 months, annually)
- ${userState}-specific 529 or grant programs
- Investment mix adjustments given ${optimizerVariables.investmentStrategy ?? goal.riskProfile}
- Loan planning and repayment considerations if loans are included
- Family financial milestones tied to this goal

  Return ONLY the JSON array with no extra text.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON response
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const recommendations = JSON.parse(jsonMatch[0]);
        return recommendations.slice(0, 7); // Ensure max 7 recommendations
      }
    } catch (parseError) {
      console.error('Error parsing AI recommendations:', parseError);
    }
    
    // Fallback if parsing fails
    return generateDefaultPersonalizedRecommendations(goal, profile);
    
  } catch (error) {
    console.error('Error generating personalized recommendations:', error);
    return generateDefaultPersonalizedRecommendations(goal, profile);
  }
}

// Default personalized recommendations if AI fails
function generateDefaultPersonalizedRecommendations(goal: any, profile: any): any[] {
  const recommendations = [];
  const currentYear = new Date().getFullYear();
  const yearsUntilStart = goal.startYear - currentYear;
  const fundingGap = goal.projection.totalCost - goal.projection.totalFunded;
  const monthlyIncreaseNeeded = goal.projection.monthlyContributionNeeded - (goal.monthlyContribution || 0);
  const userState = goal.stateOfResidence || profile?.state || 'CA';
  
  // Critical: Very low funding
  if (goal.projection.fundingPercentage < 30) {
    recommendations.push({
      title: `Urgent: Increase ${goal.studentName}'s Education Savings`,
      description: `With only ${goal.projection.fundingPercentage}% funded and ${yearsUntilStart} years until ${goal.goalType}, immediate action is needed. Increase monthly savings by $${Math.round(monthlyIncreaseNeeded)} to reach your goal.`,
      category: "savings strategy",
      priority: 1,
      actionSteps: [
        `Set up automatic transfer of $${Math.round(monthlyIncreaseNeeded / 2)} immediately`,
        `Review budget to find additional $${Math.round(monthlyIncreaseNeeded / 2)} within 30 days`,
        `Consider one-time contributions from bonuses or tax refunds`,
        `Explore extended family gifting options`
      ]
    });
  }
  
  // Tax optimization
  if (goal.accountType !== '529' || !goal.accountType) {
    recommendations.push({
      title: `Open ${userState} 529 Plan for ${goal.studentName}`,
      description: `You're missing out on tax-free growth and potential state tax deductions. A 529 plan could save you thousands in taxes.`,
      category: "tax planning",
      priority: goal.projection.fundingPercentage < 50 ? 2 : 3,
      actionSteps: [
        `Research ${userState} 529 plan at [state website]`,
        `Compare investment options and fees`,
        `Transfer existing education savings to 529`,
        `Set up automatic monthly contributions`
      ]
    });
  }
  
  // Investment strategy based on timeline
  if (yearsUntilStart <= 5 && goal.riskProfile !== 'conservative') {
    recommendations.push({
      title: "Adjust Investment Risk for Near-Term Goal",
      description: `With only ${yearsUntilStart} years until ${goal.studentName} starts ${goal.goalType}, shift to more conservative investments to protect against market volatility.`,
      category: "investment strategy",
      priority: 2,
      actionSteps: [
        "Move 50% to stable value or bond funds immediately",
        "Shift remaining equity allocation over next 12 months",
        "Consider age-based investment option for automatic rebalancing",
        "Review and adjust quarterly as start date approaches"
      ]
    });
  }
  
  // Financial aid optimization
  if (goal.goalType === 'college' && profile?.annualIncome && profile.annualIncome < 200000) {
    recommendations.push({
      title: "Optimize for Financial Aid Eligibility",
      description: `Strategic planning can increase ${goal.studentName}'s eligibility for need-based aid. 529 assets have favorable treatment in financial aid calculations.`,
      category: "financial aid",
      priority: 3,
      actionSteps: [
        "Keep education savings in parent-owned 529 (assessed at 5.64% vs 20% for student assets)",
        "Avoid distributions in years prior to aid applications",
        `Start CSS Profile prep ${Math.max(0, yearsUntilStart - 2)} years before college`,
        "Research schools with generous aid policies"
      ]
    });
  }
  
  // Funding sources
  if (goal.scholarshipPerYear === 0 && goal.goalType === 'college') {
    recommendations.push({
      title: `Build ${goal.studentName}'s Scholarship Strategy`,
      description: `The average student receives $7,500 in scholarships. Start building a competitive profile now to reduce college costs.`,
      category: "funding sources",
      priority: 4,
      actionSteps: [
        "Create scholarship tracking spreadsheet with deadlines",
        "Focus on local and niche scholarships (less competition)",
        "Encourage leadership roles and community service",
        "Start essay drafts junior year of high school",
        "Research merit aid at target schools"
      ]
    });
  }
  
  // Specific school planning
  if (goal.collegeName) {
    recommendations.push({
      title: `${goal.collegeName} Specific Planning`,
      description: `Optimize your savings strategy for ${goal.studentName}'s target school with annual costs of $${(goal.costPerYear || 0).toLocaleString()}.`,
      category: "savings strategy",
      priority: 3,
      actionSteps: [
        `Research ${goal.collegeName} merit scholarship requirements`,
        "Connect with financial aid office about aid policies",
        "Explore work-study and campus employment options",
        "Consider starting at community college if costs are high"
      ]
    });
  }
  
  // Risk management
  if (fundingGap > 50000) {
    recommendations.push({
      title: "Protect Education Funding with Life Insurance",
      description: `Ensure ${goal.studentName}'s education is funded even if something happens to you. The $${fundingGap.toLocaleString()} gap represents significant risk.`,
      category: "risk management",
      priority: 5,
      actionSteps: [
        `Calculate life insurance need including $${fundingGap.toLocaleString()} education gap`,
        "Get term life quotes from 3+ carriers",
        "Consider adding education funding rider",
        "Review and update beneficiaries"
      ]
    });
  }
  
  return recommendations.sort((a, b) => a.priority - b.priority);
}

// Generate recommendations for all education goals
async function generateAllGoalsRecommendations(
  goals: any[], 
  profile: FinancialProfile | null
): Promise<string> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return "AI recommendations unavailable. Please configure Gemini API.";
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });
    
    const userState = profile?.state || 'CA';
    const retirementOnTrack = true; // Simplified - would calculate from profile
    
    // Calculate aggregate statistics
    const totalCost = goals.reduce((sum, goal) => sum + (goal.projection?.totalCost || 0), 0);
    const totalFunded = goals.reduce((sum, goal) => sum + (goal.projection?.totalFunded || 0), 0);
    const totalMonthlyNeeded = goals.reduce((sum, goal) => sum + (goal.projection?.monthlyContributionNeeded || 0), 0);
    const fundingPercentage = totalCost > 0 ? Math.round((totalFunded / totalCost) * 100) : 0;
    
    // Build goal summary
    const goalsSummary = goals.map(goal => 
      `- ${goal.studentName} (${goal.goalType === 'college' ? 'College' : 'Pre-K-12'}): ` +
      `${goal.startYear}-${goal.endYear}, $${goal.projection?.totalCost.toLocaleString()} total cost, ` +
      `${goal.projection?.fundingPercentage}% funded`
    ).join('\n');
    
    const prompt = `
    The client is planning for ${goals.length} education goals. Here's the overview:
    
    Education Goals:
    ${goalsSummary}
    
    Total projected cost across all goals: $${totalCost.toLocaleString()}
    Currently funded amount: $${totalFunded.toLocaleString()} (${fundingPercentage}% of total)
    Total monthly savings needed: $${totalMonthlyNeeded.toLocaleString()}
    
    They live in ${userState}.
    
    Provide comprehensive advice covering:
    1. Overall savings strategy to meet all education goals
    2. Prioritization if they cannot fully fund all goals
    3. Tax-advantaged savings vehicles (529 plans, Coverdell ESAs) and state-specific benefits in ${userState}
    4. Financial aid strategies and how savings affect aid eligibility
    5. Alternative funding sources (scholarships, grants, work-study, loans)
    6. Balancing education savings with other financial priorities${retirementOnTrack ? " (retirement is on track)" : " (especially retirement)"}
    
    Format your response with clear sections and bullet points. Be specific and actionable.
    Include any relevant new laws or regulations (like 529-to-Roth rollovers).
    End with a brief disclaimer about this being general educational information.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating all goals recommendations:', error);
    
    // Fallback recommendations
    const totalCost = goals.reduce((sum, goal) => sum + (goal.projection?.totalCost || 0), 0);
    const totalFunded = goals.reduce((sum, goal) => sum + (goal.projection?.totalFunded || 0), 0);
    const totalMonthlyNeeded = goals.reduce((sum, goal) => sum + (goal.projection?.monthlyContributionNeeded || 0), 0);
    const fundingPercentage = totalCost > 0 ? Math.round((totalFunded / totalCost) * 100) : 0;
    
    return `Based on our analysis of your ${goals.length} education goals:
    
## Overall Summary
• Total education costs: $${totalCost.toLocaleString()}
• Currently funded: $${totalFunded.toLocaleString()} (${fundingPercentage}%)
• Total monthly savings needed: $${totalMonthlyNeeded.toLocaleString()}

## Savings Strategy
• Open separate 529 plans for each beneficiary to maximize flexibility
• Consider age-based investment options that automatically become more conservative as college approaches
• Take advantage of any state tax benefits for 529 contributions in your state

## Priority Recommendations
${goals.map(goal => {
  const needsAttention = goal.projection?.fundingPercentage < 70;
  return needsAttention ? 
    `• ${goal.studentName}: Increase monthly savings to $${goal.projection?.monthlyContributionNeeded.toLocaleString()} (currently ${goal.projection?.fundingPercentage}% funded)` :
    `• ${goal.studentName}: On track with ${goal.projection?.fundingPercentage}% funded`;
}).join('\n')}

## Financial Aid Considerations
• 529 assets owned by parents are assessed at up to 5.64% for federal financial aid
• Complete the FAFSA for each student, even if you think you won't qualify
• Research merit-based scholarships that aren't need-based

## Important Reminders
• Don't sacrifice retirement savings - there are loans for college but not for retirement
• Review and adjust your education savings plan annually
• Consider having students contribute through summer jobs or work-study programs

This is general educational information. Consult a financial advisor for personalized advice.`;
  }
}

// Generate estate planning recommendations
function generateEstatePlanningRecommendations(plan: EstatePlan, profile: any, analysis: any): string[] {
  const recommendations = [];
  
  // Tax minimization strategies
  if (analysis.federalEstateTax > 0) {
    recommendations.push(`Consider establishing an Irrevocable Life Insurance Trust (ILIT) to remove life insurance proceeds from your taxable estate`);
    recommendations.push(`Maximize annual gift tax exclusions ($18,000 per recipient in 2024) to reduce estate size`);
    
    if (profile.maritalStatus === 'married') {
      recommendations.push(`Implement credit shelter trust strategy to fully utilize both spouses' estate tax exemptions`);
    }
  }
  
  // Charitable planning
  if (analysis.totalEstateValue > 5000000) {
    recommendations.push(`Consider a Charitable Remainder Trust (CRT) for income tax deduction and estate tax reduction`);
    recommendations.push(`Explore Donor Advised Funds (DAF) for flexible charitable giving with immediate tax benefits`);
  }
  
  // Asset protection
  recommendations.push(`Review beneficiary designations on retirement accounts and life insurance policies`);
  
  if (!plan.trustStrategies || (plan.trustStrategies as any[]).length === 0) {
    recommendations.push(`Consider a Revocable Living Trust to avoid probate and maintain privacy`);
  }
  
  return recommendations;
}

// Emergency Readiness Score (ERS) - CFP Board aligned calculation
function calculateERS(inputs: {
  EF_bal: number;
  M_exp: number;
  Job_var: string;
  HH_type: string;
  N_dep: number;
  Ins_health: boolean;
  Ins_disab: boolean;
  Ins_home: boolean;
  Avail_credit: number;
  Util_rate: number;
  Plan_doc: boolean;
}) {
  const { EF_bal, M_exp, Job_var, HH_type, N_dep, Ins_health, Ins_disab, Ins_home, Avail_credit, Util_rate, Plan_doc } = inputs;

  console.log('=== ERS CALCULATION BREAKDOWN ===');
  console.log('Input data:', {
    EF_bal, M_exp, Job_var, HH_type, N_dep,
    Ins_health, Ins_disab, Ins_home,
    Avail_credit, Util_rate, Plan_doc
  });

  // Step 1: Determine Target-Month Buffer (TMB)
  let TMB = 3; // Base for dual income & stable job
  console.log('Step 1 - TMB Calculation:');
  console.log('  Base TMB: 3 months');
  
  if (HH_type === 'single') {
    TMB += 1;
    console.log('  +1 for single income household');
  }
  if (Job_var === 'variable') {
    TMB += 1;
    console.log('  +1 for variable income');
  }
  if (N_dep >= 3) {
    TMB += 1;
    console.log('  +1 for 3+ dependents');
  }
  TMB = Math.min(TMB, 12); // Cap at 12
  console.log('  Final TMB:', TMB, 'months');

  // Step 2: Compute Emergency-Fund Adequacy Ratio (EFAR)
  const monthsOfExpenses = M_exp > 0 ? EF_bal / M_exp : 0;
  const EFAR = Math.min(monthsOfExpenses / TMB, 1.0);
  console.log('Step 2 - EFAR Calculation:');
  console.log('  Emergency fund balance: $' + EF_bal.toLocaleString());
  console.log('  Monthly expenses: $' + M_exp.toLocaleString());
  console.log('  Months of expenses covered:', monthsOfExpenses.toFixed(1));
  console.log('  EFAR (capped at 1.0):', EFAR.toFixed(3));

  // Step 3: Convert EFAR to 0-70 sub-score
  let score = Math.round(EFAR * 70);
  console.log('Step 3 - Base Score:');
  console.log('  Base score (EFAR × 70):', score, '/70 points');

  // Step 4: Add complementary risk-buffers (30 pts total)
  console.log('Step 4 - Risk Buffer Additions:');
  
  // Insurance adequacy (max 15 points)
  let insurancePoints = 0;
  console.log('  Insurance Coverage (max 15 points):');
  if (Ins_health) {
    insurancePoints += 5;
    console.log('    Health insurance: +5 points');
  } else {
    console.log('    Health insurance: 0 points (not covered)');
  }
  if (Ins_disab) {
    insurancePoints += 5;
    console.log('    Disability insurance: +5 points');
  } else {
    console.log('    Disability insurance: 0 points (not covered)');
  }
  if (Ins_home) {
    insurancePoints += 5;
    console.log('    Home/Renters insurance: +5 points');
  } else {
    console.log('    Home/Renters insurance: 0 points (not covered)');
  }
  console.log('    Insurance subtotal:', insurancePoints, '/15 points');
  
  // Credit access (max 10 points)
  let creditPoints = 0;
  console.log('  Credit Access (max 10 points):');
  console.log('    Available credit: $' + Avail_credit.toLocaleString());
  console.log('    Credit utilization:', (Util_rate * 100).toFixed(1) + '%');
  console.log('    Requirement: Available credit ≥ $' + M_exp.toLocaleString() + ' AND utilization < 30%');
  if (Avail_credit >= M_exp && Util_rate < 0.30) {
    creditPoints = 10;
    console.log('    Credit access: +10 points (criteria met)');
  } else {
    console.log('    Credit access: 0 points (criteria not met)');
  }
  
  // Documented emergency plan (max 5 points)
  let planPoints = Plan_doc ? 5 : 0;
  console.log('  Emergency Plan Documentation (max 5 points):');
  console.log('    Has Will AND Power of Attorney:', Plan_doc);
  console.log('    Plan documentation: +' + planPoints + ' points');
  
  // Step 5: Total score
  const totalScore = score + insurancePoints + creditPoints + planPoints;
  console.log('Step 5 - Final Score:');
  console.log('  Base score:', score, '/70');
  console.log('  Insurance points:', insurancePoints, '/15');
  console.log('  Credit points:', creditPoints, '/10');
  console.log('  Plan points:', planPoints, '/5');
  console.log('  TOTAL ERS:', totalScore, '/100');
  console.log('=== END ERS BREAKDOWN ===');
  
  return Math.min(100, Math.max(0, totalScore));
}

// Helper function to calculate available credit
function calculateAvailableCredit(liabilities: any[]): number {
  return liabilities
    .filter(liability => liability.type && liability.type.toLowerCase().includes('credit'))
    .reduce((total, creditCard) => {
      const creditLimit = creditCard.creditLimit || (creditCard.balance * 3); // Estimate if not provided
      const availableCredit = creditLimit - (creditCard.balance || 0);
      return total + Math.max(0, availableCredit);
    }, 0);
}

// Helper function to calculate credit utilization rate
function calculateCreditUtilization(liabilities: any[]): number {
  const creditCards = liabilities.filter(liability => 
    liability.type && liability.type.toLowerCase().includes('credit')
  );
  
  if (creditCards.length === 0) return 0;
  
  const totalBalance = creditCards.reduce((sum, card) => sum + (card.balance || 0), 0);
  const totalLimit = creditCards.reduce((sum, card) => {
    const limit = card.creditLimit || (card.balance * 3); // Estimate if not provided
    return sum + limit;
  }, 0);
  
  return totalLimit > 0 ? totalBalance / totalLimit : 0;
}



// Financial calculations
async function calculateFinancialMetrics(profileData: any, estateDocuments: any[] = []) {
  const assets = Array.isArray(profileData.assets) ? profileData.assets : [];
  const liabilities = Array.isArray(profileData.liabilities) ? profileData.liabilities : [];
  const monthlyExpenses = profileData.monthlyExpenses || {};
  const primaryResidence = profileData.primaryResidence || {};
  
  const totalAssets = assets.reduce(
    (sum: number, asset: any) => sum + (asset.value || 0),
    0,
  );
  const totalLiabilities = liabilities.reduce(
    (sum: number, liability: any) => sum + (liability.balance || 0),
    0,
  );
  const homeEquity = primaryResidence
    ? (primaryResidence.marketValue || 0) - (primaryResidence.mortgageBalance || 0)
    : 0;

  const netWorth = Number(totalAssets || 0) + Number(homeEquity || 0) - Number(totalLiabilities || 0);
  const annualIncome = Number(profileData.annualIncome || 0) + Number(profileData.spouseAnnualIncome || 0);
  
  // Calculate monthly income based on employment status
  const userEmploymentStatus = (profileData.employmentStatus || '').toLowerCase();
  const spouseEmploymentStatus = (profileData.spouseEmploymentStatus || '').toLowerCase();
  const userTakeHome = Number(profileData.takeHomeIncome || 0);
  const spouseTakeHome = Number(profileData.spouseTakeHomeIncome || 0);
  const userAnnualIncome = Number(profileData.annualIncome || 0);
  const spouseAnnualIncome = Number(profileData.spouseAnnualIncome || 0);
  const otherMonthlyIncome = Number(profileData.otherIncome || 0); // Other income is typically monthly

  // Convert annual take-home to monthly (take-home values are stored as annual)
  const userTakeHomeMonthly = userTakeHome > 0 ? userTakeHome / 12 : 0;
  const spouseTakeHomeMonthly = spouseTakeHome > 0 ? spouseTakeHome / 12 : 0;

  // Calculate user monthly income
  let userMonthlyIncome = 0;
  if (userEmploymentStatus.includes('self-employed') || userEmploymentStatus.includes('self employed')) {
    // Self-employed: use gross annual income divided by 12
    userMonthlyIncome = userAnnualIncome / 12;
  } else if (userTakeHomeMonthly > 0) {
    // If take-home income is provided, use it (most accurate for employed)
    userMonthlyIncome = userTakeHomeMonthly;
  } else if (userAnnualIncome > 0) {
    // Fallback: use annual income / 12 if no take-home specified
    userMonthlyIncome = userAnnualIncome / 12;
  }

  // Calculate spouse monthly income (if married/partnered)
  let spouseMonthlyIncome = 0;
  if (profileData.maritalStatus === 'married' || profileData.maritalStatus === 'partnered') {
    if (spouseEmploymentStatus.includes('self-employed') || spouseEmploymentStatus.includes('self employed')) {
      // Self-employed spouse: use gross annual income divided by 12
      spouseMonthlyIncome = spouseAnnualIncome / 12;
    } else if (spouseTakeHomeMonthly > 0) {
      // If spouse take-home income is provided, use it (most accurate for employed)
      spouseMonthlyIncome = spouseTakeHomeMonthly;
    } else if (spouseAnnualIncome > 0) {
      // Fallback: use annual income / 12 if no take-home specified
      spouseMonthlyIncome = spouseAnnualIncome / 12;
    }
  }
  
  // Total monthly income includes user, spouse, and other income
  const monthlyIncome = userMonthlyIncome + spouseMonthlyIncome + otherMonthlyIncome;
  
  console.log('=== INCOME CALCULATION DEBUG ===');
  console.log('User Employment Status:', profileData.employmentStatus);
  console.log('Spouse Employment Status:', profileData.spouseEmploymentStatus);
  console.log('User Annual Income (gross):', profileData.annualIncome);
  console.log('User Take-Home Income (monthly):', userTakeHome);
  console.log('Spouse Annual Income (gross):', profileData.spouseAnnualIncome);
  console.log('Spouse Take-Home Income (monthly):', spouseTakeHome);
  console.log('Final User Monthly Income:', userMonthlyIncome);
  console.log('Final Spouse Monthly Income:', spouseMonthlyIncome);
  console.log('Total Monthly Income:', monthlyIncome);
  console.log('=== END INCOME DEBUG ===');
  
  console.log('=== NET WORTH COMPONENTS ===');
  console.log('Total Assets:', totalAssets);
  console.log('Home Equity:', homeEquity);
  console.log('Total Liabilities:', totalLiabilities);
  console.log('Net Worth:', netWorth);
  console.log('User Annual Income:', profileData.annualIncome);
  console.log('Spouse Annual Income:', profileData.spouseAnnualIncome);
  console.log('Total Annual Income:', annualIncome);
  console.log('=== END NET WORTH COMPONENTS ===');
  // Calculate total monthly expenses
  // For employed users: take-home income already has taxes deducted, so don't include expectedAnnualTaxes
  // For self-employed: we use gross income, so we DO include expectedAnnualTaxes
  let totalExpenses = 0;
  
  // Check if user or spouse is self-employed to determine if we should include taxes
  const userIsSelfEmployed = userEmploymentStatus.includes('self-employed') || userEmploymentStatus.includes('self employed');
  const spouseIsSelfEmployed = spouseEmploymentStatus.includes('self-employed') || spouseEmploymentStatus.includes('self employed');
  const anyoneIsSelfEmployed = userIsSelfEmployed || spouseIsSelfEmployed;
  
  // 3-tier hierarchy for expenses
  // First calculate categorized sum (excluding metadata)
  let categorizedSum = 0;
  if (monthlyExpenses) {
    categorizedSum = Object.entries(monthlyExpenses)
      .filter(([key]) => !key.startsWith('_'))
      .reduce((sum: number, [key, expense]: [string, any]) => {
        // Handle annual taxes for self-employed
        if (key === 'expectedAnnualTaxes' && anyoneIsSelfEmployed) {
          return sum + ((Number(expense) || 0) / 12);
        }
        // Skip annual taxes for employed (to avoid double counting)
        if (key === 'expectedAnnualTaxes' && !anyoneIsSelfEmployed) {
          return sum;
        }
        return sum + (Number(expense) || 0);
      }, 0);
  }
  
  const manualTotalExpenses = parseFloat(profileData.totalMonthlyExpenses) || 0;
  const autoCalculatedExpenses = monthlyExpenses?._lastAutoFill?.total || 0;
  
  // Use hierarchy: categorized > manual > auto-calculated
  if (categorizedSum > 0) {
    totalExpenses = categorizedSum;
  } else if (manualTotalExpenses > 0) {
    totalExpenses = manualTotalExpenses;
  } else if (autoCalculatedExpenses > 0) {
    totalExpenses = autoCalculatedExpenses;
  } else if (anyoneIsSelfEmployed) {
    // Include all expenses including annual taxes (divided by 12) for self-employed
    totalExpenses = Object.values(monthlyExpenses).reduce(
      (sum: number, expense: any, index: number, arr: any[]) => {
        const key = Object.keys(monthlyExpenses)[index];
        if (key === 'expectedAnnualTaxes') {
          return sum + ((Number(expense) || 0) / 12); // Convert annual to monthly
        }
        return sum + (Number(expense) || 0);
      },
      0,
    );
  } else {
    // For employed users, exclude expectedAnnualTaxes to avoid double counting
    const monthlyExpensesOnly = { ...monthlyExpenses };
    if ('expectedAnnualTaxes' in monthlyExpensesOnly) {
      delete (monthlyExpensesOnly as any).expectedAnnualTaxes;
    }
    
    totalExpenses = Object.values(monthlyExpensesOnly).reduce(
      (sum: number, expense: any) => sum + (Number(expense) || 0),
      0,
    );
  }

  // ALL debt payments are already included in the monthly expenses entered by the user
  // (housing includes mortgage, creditCardPayments, studentLoanPayments, otherDebtPayments fields)
  // So we should NOT add any debt payments from liabilities to avoid double counting
  const monthlyDebtPayments = 0;

  // Calculate monthly retirement contributions
  const userRetirementContributions = profileData.retirementContributions || { employee: 0, employer: 0 };
  const spouseRetirementContributions = profileData.spouseRetirementContributions || { employee: 0, employer: 0 };
  
  // Include IRA contributions (convert annual to monthly if they exist)
  const monthlyTraditionalIRA = (profileData.traditionalIRAContribution || 0) / 12;
  const monthlyRothIRA = (profileData.rothIRAContribution || 0) / 12;
  const monthlySpouseTraditionalIRA = (profileData.spouseTraditionalIRAContribution || 0) / 12;
  const monthlySpouseRothIRA = (profileData.spouseRothIRAContribution || 0) / 12;
  
  // Only employee contributions affect cash flow (employer contributions don't come from take-home pay)
  const totalMonthlyRetirementContributions = 
    (userRetirementContributions.employee || 0) + 
    (spouseRetirementContributions.employee || 0) +
    monthlyTraditionalIRA + monthlyRothIRA + 
    monthlySpouseTraditionalIRA + monthlySpouseRothIRA;

  console.log('=== ENHANCED CASH FLOW CALCULATION DEBUG ===');
  console.log('User Annual Income:', userAnnualIncome);
  console.log('User Take-Home (ANNUAL, stored):', userTakeHome);
  console.log('User Take-Home (MONTHLY, calculated):', userTakeHomeMonthly);
  console.log('User Monthly Income (final calculated):', userMonthlyIncome);
  console.log('Spouse Annual Income:', spouseAnnualIncome);
  console.log('Spouse Take-Home (ANNUAL, stored):', spouseTakeHome);
  console.log('Spouse Take-Home (MONTHLY, calculated):', spouseTakeHomeMonthly);
  console.log('Spouse Monthly Income (final calculated):', spouseMonthlyIncome);
  console.log('Other Monthly Income:', otherMonthlyIncome);
  console.log('Total Monthly Income:', monthlyIncome);
  console.log('Total Monthly Expenses (includes all debt payments):', totalExpenses);
  console.log('Debt payments already in expenses:', {
    creditCards: monthlyExpenses.creditCardPayments || 0,
    studentLoans: monthlyExpenses.studentLoanPayments || 0,
    otherDebt: monthlyExpenses.otherDebtPayments || 0,
    mortgage: Number(primaryResidence.monthlyPayment) || 0
  });
  console.log('User Retirement Contributions (employee + employer):', (userRetirementContributions.employee || 0) + (userRetirementContributions.employer || 0));
  console.log('Spouse Retirement Contributions (employee + employer):', (spouseRetirementContributions.employee || 0) + (spouseRetirementContributions.employer || 0));
  console.log('Monthly IRA Contributions (user Traditional + Roth):', monthlyTraditionalIRA + monthlyRothIRA);
  console.log('Monthly Spouse IRA Contributions (Traditional + Roth):', monthlySpouseTraditionalIRA + monthlySpouseRothIRA);
  console.log('Total Monthly Retirement Contributions:', totalMonthlyRetirementContributions);
  console.log('Liabilities Detail:', liabilities.map((l: any) => ({ type: l.type, balance: l.balance, monthlyPayment: l.monthlyPayment })));
  console.log('Primary Residence Detail:', { marketValue: primaryResidence.marketValue, mortgageBalance: primaryResidence.mortgageBalance, monthlyPayment: primaryResidence.monthlyPayment });
  console.log('=== END ENHANCED CASH FLOW DEBUG ===');

  // Calculate monthly cash flow
  // totalExpenses already includes ALL debt payments (mortgage in housing, credit cards, student loans, other debt)
  // Only subtract expenses and retirement contributions from income
  const monthlyCashFlow = monthlyIncome - totalExpenses - totalMonthlyRetirementContributions;

  // Calculate DTI ratio using debt payments from expenses (credit cards, student loans, other debt)
  const debtPaymentsFromExpenses = 
    (monthlyExpenses.creditCardPayments || 0) + 
    (monthlyExpenses.studentLoanPayments || 0) + 
    (monthlyExpenses.otherDebtPayments || 0) +
    (Number(primaryResidence.monthlyPayment) || 0);
  const dtiRatio = monthlyIncome > 0 ? (debtPaymentsFromExpenses / monthlyIncome) * 100 : 0;

  // Calculate savings rate (debt payments are already in totalExpenses)
  const annualSavings = Math.max(0, annualIncome - (totalExpenses * 12));
  const savingsRate = annualIncome > 0 ? (annualSavings / annualIncome) * 100 : 0;

  // Calculate emergency fund - use emergency_fund_size field or look for emergency/savings assets
  const emergencyFundFromAssets = assets
    .filter((asset: any) => 
      asset.type && (
        asset.type.toLowerCase().includes('emergency') ||
        asset.type.toLowerCase().includes('savings') ||
        asset.type.toLowerCase().includes('checking')
      )
    )
    .reduce((sum: number, asset: any) => sum + asset.value, 0);
  
  // Use the explicit emergency_fund_size field if provided, otherwise use calculated from assets
  const emergencyFund = Number(profileData.emergencyFundSize) || emergencyFundFromAssets;

  const emergencyMonths = totalExpenses > 0 ? emergencyFund / totalExpenses : 0;

  // Calculate risk profile from questionnaire
  const riskQuestionnaire = Array.isArray(profileData.riskQuestionnaire) ? profileData.riskQuestionnaire : 
                            Array.isArray(profileData.riskQuestions) ? profileData.riskQuestions : [];
  
  // New simplified scoring: Just use the first value (1-5) directly
  const riskScore = riskQuestionnaire.length > 0 ? riskQuestionnaire[0] : 3; // Default to Moderate (3)
  
  // Map risk score to profile according to simplified system
  let riskProfile = 'Moderate';
  let targetAllocation = { usStocks: 35, intlStocks: 15, bonds: 35, alternatives: 10, cash: 5 };
  
  if (riskScore === 1) {
    riskProfile = 'Conservative';
    targetAllocation = { usStocks: 15, intlStocks: 5, bonds: 60, alternatives: 5, cash: 15 };
  } else if (riskScore === 2) {
    riskProfile = 'Moderately Conservative';
    targetAllocation = { usStocks: 25, intlStocks: 10, bonds: 45, alternatives: 10, cash: 10 };
  } else if (riskScore === 3) {
    riskProfile = 'Moderate';
    targetAllocation = { usStocks: 35, intlStocks: 15, bonds: 35, alternatives: 10, cash: 5 };
  } else if (riskScore === 4) {
    riskProfile = 'Moderately Aggressive';
    targetAllocation = { usStocks: 45, intlStocks: 20, bonds: 25, alternatives: 8, cash: 2 };
  } else if (riskScore === 5) {
    riskProfile = 'Aggressive';
    targetAllocation = { usStocks: 55, intlStocks: 25, bonds: 10, alternatives: 8, cash: 2 };
  }

  // Calculate spouse risk profile if married and spouse risk questions exist
  let spouseRiskProfile = 'Not Assessed';
  let spouseTargetAllocation = null;
  let spouseRiskScore = 0;
  
  console.log('=== SPOUSE RISK PROFILE CALCULATION ===');
  console.log('Marital Status:', profileData.maritalStatus);
  console.log('Spouse Risk Questions Type:', typeof profileData.spouseRiskQuestions);
  console.log('Spouse Risk Questions:', profileData.spouseRiskQuestions);
  console.log('Is Array?', Array.isArray(profileData.spouseRiskQuestions));
  console.log('Length:', profileData.spouseRiskQuestions?.length);
  
  if (profileData.maritalStatus === 'married' && profileData.spouseRiskQuestions && Array.isArray(profileData.spouseRiskQuestions) && profileData.spouseRiskQuestions.length > 0) {
    const spouseRiskQuestionnaire = profileData.spouseRiskQuestions;
    // New simplified scoring: Just use the first value (1-5) directly
    spouseRiskScore = spouseRiskQuestionnaire.length > 0 ? spouseRiskQuestionnaire[0] : 3; // Default to Moderate (3)
    
    console.log('Spouse Risk Questionnaire:', spouseRiskQuestionnaire);
    console.log('Spouse Risk Score:', spouseRiskScore);
    
    // Map spouse risk score to profile using simplified system
    if (spouseRiskScore === 1) {
      spouseRiskProfile = 'Conservative';
      spouseTargetAllocation = { usStocks: 15, intlStocks: 5, bonds: 60, alternatives: 5, cash: 15 };
    } else if (spouseRiskScore === 2) {
      spouseRiskProfile = 'Moderately Conservative';
      spouseTargetAllocation = { usStocks: 25, intlStocks: 10, bonds: 45, alternatives: 10, cash: 10 };
    } else if (spouseRiskScore === 3) {
      spouseRiskProfile = 'Moderate';
      spouseTargetAllocation = { usStocks: 35, intlStocks: 15, bonds: 35, alternatives: 10, cash: 5 };
    } else if (spouseRiskScore === 4) {
      spouseRiskProfile = 'Moderately Aggressive';
      spouseTargetAllocation = { usStocks: 45, intlStocks: 20, bonds: 25, alternatives: 8, cash: 2 };
    } else if (spouseRiskScore === 5) {
      spouseRiskProfile = 'Aggressive';
      spouseTargetAllocation = { usStocks: 55, intlStocks: 25, bonds: 10, alternatives: 8, cash: 2 };
    }
  }
  
  console.log('Spouse Risk Profile:', spouseRiskProfile);
  console.log('Spouse Target Allocation:', spouseTargetAllocation);
  console.log('=== END SPOUSE RISK PROFILE CALCULATION ===');

  // Calculate optimal Social Security claiming ages
  const { calculateOptimalSSClaimAges } = await import("./optimal-ss-claim");
  const ssOptimization = calculateOptimalSSClaimAges(profileData);
  
  // COMPREHENSIVE FINANCIAL HEALTH SCORE CALCULATION
  // Based on AFFLUVIA specification with 5 weighted components

  // 1. Net Worth vs Income Score (25% weight)
  const netWorthRatio = annualIncome > 0 ? netWorth / annualIncome : 0;
  console.log('=== NET WORTH VS INCOME CALCULATION ===');
  console.log('Net Worth:', netWorth);
  console.log('Annual Income:', annualIncome);
  console.log('Net Worth Ratio:', netWorthRatio);
  
  let netWorthScore = 0;
  if (netWorthRatio >= 5) {
    netWorthScore = 100;
  } else if (netWorthRatio >= 0) {
    netWorthScore = 30 + (netWorthRatio / 5) * 70;
  } else if (netWorthRatio >= -0.5) {
    netWorthScore = Math.max(0, 30 + (netWorthRatio + 0.5) / 0.5 * 30);
  } else {
    netWorthScore = 0;
  }
  console.log('Net Worth Score:', netWorthScore);
  console.log('=== END NET WORTH CALCULATION ===');

  // 2. Emergency Fund Score (20% weight) - ENHANCED CALCULATION
  const monthlyExpensesData = profileData.monthlyExpenses || {};
  const emergencyFundSize = Number(profileData.emergencyFundSize) || emergencyFund; // Use calculated emergencyFund if emergencyFundSize not provided

  // Calculate essential expenses (excluding entertainment)
  const essentialExpenses = 
    (Number(monthlyExpensesData.housing) || 0) +
    (Number(monthlyExpensesData.transportation) || 0) +
    (Number(monthlyExpensesData.food) || 0) +
    (Number(monthlyExpensesData.utilities) || 0) +
    (Number(monthlyExpensesData.healthcare) || 0) +
    (Number(monthlyExpensesData.creditCardPayments) || 0) +
    (Number(monthlyExpensesData.studentLoanPayments) || 0) +
    (Number(monthlyExpensesData.otherDebtPayments) || 0) +
    (Number(monthlyExpensesData.householdExpenses) || 0) +
    (Number(monthlyExpensesData.monthlyTaxes) || 0) +
    (Number(monthlyExpensesData.other) || 0);

  const monthsCoveredEssential = essentialExpenses > 0 ? emergencyFundSize / essentialExpenses : 0;
  
  // Updated scoring logic: 3 months = Good (75), 6 months = Excellent (100)
  // This aligns with the "3-6 months" recommendation messaging
  let emergencyScore = 0;
  if (monthsCoveredEssential >= 6) {
    emergencyScore = 100;
  } else if (monthsCoveredEssential >= 3) {
    emergencyScore = 75 + ((monthsCoveredEssential - 3) / 3) * 25; // 75-100 range for 3-6 months
  } else if (monthsCoveredEssential >= 1) {
    emergencyScore = 25 + ((monthsCoveredEssential - 1) / 2) * 50; // 25-75 range for 1-3 months  
  } else {
    emergencyScore = Math.max(0, monthsCoveredEssential * 25);
  }

  // 3. Debt-to-Income Score (20% weight)
  let dtiScore = 0;
  if (dtiRatio <= 20) {
    dtiScore = 100;
  } else if (dtiRatio <= 35) {
    dtiScore = 100 - (dtiRatio - 20) * (20 / 15);
  } else if (dtiRatio < 50) {
    dtiScore = 80 - (dtiRatio - 35) * (80 / 15);
  } else {
    dtiScore = 0;
  }

  // 4. Savings Rate Score (20% weight)
  let savingsRateScore = 0;
  if (savingsRate >= 20) {
    savingsRateScore = 100;
  } else if (savingsRate >= 15) {
    savingsRateScore = 80 + (Math.min(savingsRate, 25) - 15) * 2;
  } else if (savingsRate >= 0) {
    savingsRateScore = (savingsRate / 15) * 80;
  } else {
    savingsRateScore = 0;
  }

  // Define insurance status variables before the function
  const hasHealthInsurance = (profileData.healthInsurance as any)?.hasHealthInsurance || false;
  const hasDisabilityInsurance = (profileData.disabilityInsurance as any)?.hasDisability || false;
  const hasLifeInsurance = (profileData.lifeInsurance as any)?.hasPolicy || false;

  // 5. Insurance Adequacy Score (IAS) - Comprehensive methodology with CFP-based benchmarks
  const calculateInsuranceAdequacyScore = () => {
    const age = profileData.dateOfBirth 
      ? new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear()
      : 35;
    const spouseAge = profileData.spouseDateOfBirth 
      ? new Date().getFullYear() - new Date(profileData.spouseDateOfBirth).getFullYear()
      : null;
    const isMarriedOrPartnered = profileData.maritalStatus === 'married' || profileData.maritalStatus === 'partnered';
    const hasDependents = (profileData.dependents || 0) > 0;
    const householdIncome = monthlyIncome * 12;
    
    const userIncome = Number(profileData.annualIncome) || 0;
    const spouseIncome = Number(profileData.spouseAnnualIncome) || 0;
    
    // Category weights (adjustable)
    const weights: Record<string, number> = {
      life: 0.15,
      health: 0.20,
      disability: 0.15,
      home: 0.15,
      auto: 0.10,
      umbrella: 0.10,
      business: 0.15
    };
    
    // Sub-scores for each category
    const subScores: Record<string, number> = {};
    
    // 1. Life Insurance Score (income-proportional weighting)
    const calculateLifeScore = (income: number, coverageAmount: number, isWorking: boolean) => {
      if (!isWorking || income <= 0) return 100; // No coverage needed if not working
      
      const minBenchmark = income * 10;
      const coverageRatio = coverageAmount / minBenchmark;
      
      if (coverageRatio >= 1.5) return 100; // 15x or more = excellent
      if (coverageRatio >= 1.0) return 80 + (coverageRatio - 1.0) * 40; // 10-15x = good
      return Math.min(80, coverageRatio * 80); // Less than 10x = proportional score
    };
    
    const userLifeInsurance = (profileData.lifeInsurance as any)?.coverageAmount || 0;
    const spouseLifeInsurance = (profileData.spouseLifeInsurance as any)?.coverageAmount || 0;
    const userWorking = profileData.employmentStatus !== 'retired' && profileData.employmentStatus !== 'unemployed';
    const spouseWorking = profileData.spouseEmploymentStatus !== 'retired' && profileData.spouseEmploymentStatus !== 'unemployed';
    
    // Calculate income weights for life insurance
    const totalIncomeForLife = (userWorking ? userIncome : 0) + (spouseWorking && isMarriedOrPartnered ? spouseIncome : 0);
    const userIncomeWeight = totalIncomeForLife > 0 && userWorking ? userIncome / totalIncomeForLife : (userWorking ? 1 : 0);
    const spouseIncomeWeight = totalIncomeForLife > 0 && spouseWorking && isMarriedOrPartnered ? spouseIncome / totalIncomeForLife : 0;
    
    const userLifeScore = calculateLifeScore(userIncome, userLifeInsurance, userWorking && (hasDependents || isMarriedOrPartnered));
    const spouseLifeScore = isMarriedOrPartnered ? 
      calculateLifeScore(spouseIncome, spouseLifeInsurance, spouseWorking && (hasDependents || userIncome < householdIncome * 0.4)) : 
      100;
    
    // Weight scores by income contribution
    if (userIncomeWeight + spouseIncomeWeight > 0) {
      subScores.life = (userLifeScore * userIncomeWeight) + (spouseLifeScore * spouseIncomeWeight);
    } else {
      subScores.life = 100; // No income = no life insurance needed
    }
    
    // 2. Disability Insurance Score (income-proportional weighting)
    const calculateDisabilityScore = (income: number, hasDisability: boolean, benefitAmount: number = 0) => {
      if (income <= 0) return 100; // No coverage needed if no income
      
      if (!hasDisability) return 0;
      
      const replacementRatio = benefitAmount / (income / 12); // Monthly benefit vs monthly income
      const targetRatio = 0.65; // 65% target (middle of 60-70% range)
      
      if (replacementRatio >= targetRatio) return 100;
      return Math.min(100, (replacementRatio / targetRatio) * 100);
    };
    
    const userHasDisability = (profileData.disabilityInsurance as any)?.hasDisability || false;
    const userDisabilityBenefit = (profileData.disabilityInsurance as any)?.benefitAmount || 0;
    const spouseHasDisability = (profileData.spouseDisabilityInsurance as any)?.hasDisability || false;
    const spouseDisabilityBenefit = (profileData.spouseDisabilityInsurance as any)?.benefitAmount || 0;
    
    const userDisabilityScore = userWorking && age < 65 ? 
      calculateDisabilityScore(userIncome, userHasDisability, userDisabilityBenefit) : 100;
    const spouseDisabilityScore = isMarriedOrPartnered && spouseWorking && spouseAge && spouseAge < 65 ? 
      calculateDisabilityScore(spouseIncome, spouseHasDisability, spouseDisabilityBenefit) : 100;
    
    // Calculate income weights for disability insurance (only for working individuals under 65)
    const eligibleUserIncome = (userWorking && age < 65) ? userIncome : 0;
    const eligibleSpouseIncome = (isMarriedOrPartnered && spouseWorking && spouseAge && spouseAge < 65) ? spouseIncome : 0;
    const totalEligibleIncome = eligibleUserIncome + eligibleSpouseIncome;
    
    if (totalEligibleIncome > 0) {
      const userDisabilityWeight = eligibleUserIncome / totalEligibleIncome;
      const spouseDisabilityWeight = eligibleSpouseIncome / totalEligibleIncome;
      subScores.disability = (userDisabilityScore * userDisabilityWeight) + (spouseDisabilityScore * spouseDisabilityWeight);
    } else {
      subScores.disability = 100; // No eligible income = no disability insurance needed
    }
    
    // 3. Health Insurance Score (premium + OOP <= 10% of income)
    const healthInsuranceData = profileData.healthInsurance as any || {};
    
    if (!hasHealthInsurance) {
      subScores.health = 0;
    } else {
      const annualPremium = (healthInsuranceData.monthlyPremium || 0) * 12;
      const deductible = healthInsuranceData.annualDeductible || 0;
      const oopMax = healthInsuranceData.outOfPocketMax || 0;
      
      // Expected OOP = 50% of deductible + 10% of remaining OOP max
      const expectedOOP = (deductible * 0.5) + ((oopMax - deductible) * 0.1);
      const totalCost = annualPremium + expectedOOP;
      const costRatio = householdIncome > 0 ? totalCost / householdIncome : 1;
      
      if (costRatio <= 0.08) subScores.health = 100;
      else if (costRatio <= 0.10) subScores.health = 80;
      else if (costRatio <= 0.12) subScores.health = 60;
      else if (costRatio <= 0.15) subScores.health = 40;
      else subScores.health = 20;
    }
    
    // 4. Home/Renters Insurance Score (100% replacement cost)
    const hasHomeInsurance = (profileData.insurance as any)?.home || false;
    const dwellingLimit = (profileData.insurance as any)?.homeDwellingLimit || 0;
    const primaryResidenceValue = (profileData.primaryResidence as any)?.currentValue || 0;
    
    if (!profileData.primaryResidence || primaryResidenceValue === 0) {
      subScores.home = 100; // Not applicable if no home
    } else if (!hasHomeInsurance) {
      subScores.home = 0;
    } else {
      const coverageRatio = dwellingLimit / primaryResidenceValue;
      if (coverageRatio >= 1.0) subScores.home = 100;
      else if (coverageRatio >= 0.8) subScores.home = 80; // 80% minimum for full settlement
      else subScores.home = Math.min(80, coverageRatio * 100);
    }
    
    // 5. Auto Insurance Score (progressive scoring based on coverage levels)
    const hasAutoInsurance = (profileData.insurance as any)?.auto || false;
    const autoLimits = (profileData.insurance as any)?.autoLiabilityLimits || {};
    
    if (!hasAutoInsurance) {
      subScores.auto = 100; // Not applicable if no auto insurance needed
    } else {
      const bodilyInjuryPer = autoLimits.bodilyInjuryPerPerson || 0;
      const bodilyInjuryTotal = autoLimits.bodilyInjuryPerAccident || 0;
      const propertyDamage = autoLimits.propertyDamage || 0;
      
      // Progressive scoring based on coverage levels
      // Minimum acceptable: 25/50/25 (score 40)
      // Good: 50/100/50 (score 60)
      // Better: 100/300/100 (score 85)
      // Best: 250/500/250+ (score 100)
      
      let biPerScore = 0;
      if (bodilyInjuryPer >= 250000) biPerScore = 100;
      else if (bodilyInjuryPer >= 100000) biPerScore = 85;
      else if (bodilyInjuryPer >= 50000) biPerScore = 60;
      else if (bodilyInjuryPer >= 25000) biPerScore = 40;
      else biPerScore = bodilyInjuryPer / 25000 * 40; // Proportional below minimum
      
      let biTotalScore = 0;
      if (bodilyInjuryTotal >= 500000) biTotalScore = 100;
      else if (bodilyInjuryTotal >= 300000) biTotalScore = 85;
      else if (bodilyInjuryTotal >= 100000) biTotalScore = 60;
      else if (bodilyInjuryTotal >= 50000) biTotalScore = 40;
      else biTotalScore = bodilyInjuryTotal / 50000 * 40;
      
      let pdScore = 0;
      if (propertyDamage >= 250000) pdScore = 100;
      else if (propertyDamage >= 100000) pdScore = 85;
      else if (propertyDamage >= 50000) pdScore = 60;
      else if (propertyDamage >= 25000) pdScore = 40;
      else pdScore = propertyDamage / 25000 * 40;
      
      // Average the three scores
      subScores.auto = (biPerScore + biTotalScore + pdScore) / 3;
    }
    
    // 6. Umbrella Insurance Score (coverage >= net worth)
    const hasUmbrellaInsurance = (profileData.insurance as any)?.umbrella || false;
    const umbrellaLimit = (profileData.insurance as any)?.umbrellaLimit || 0;
    
    if (netWorth < 500000) {
      subScores.umbrella = 100; // Not typically needed for lower net worth
    } else if (!hasUmbrellaInsurance) {
      subScores.umbrella = 0;
    } else {
      const coverageRatio = umbrellaLimit / netWorth;
      subScores.umbrella = Math.min(100, coverageRatio * 100);
    }
    
    // 7. Business Insurance Score (GL: $1M/$2M minimum)
    const hasBusinessInsurance = (profileData.insurance as any)?.business || false;
    const businessLimits = (profileData.insurance as any)?.businessLiabilityLimits || {};
    const isSelfEmployed = profileData.employmentStatus === 'self-employed';
    
    if (!isSelfEmployed) {
      subScores.business = 100; // Not applicable
    } else if (!hasBusinessInsurance) {
      subScores.business = 0;
    } else {
      const perOccurrence = businessLimits.perOccurrence || 0;
      const aggregate = businessLimits.aggregate || 0;
      
      let businessScore = 0;
      if (perOccurrence >= 1000000) businessScore += 50;
      if (aggregate >= 2000000) businessScore += 50;
      
      subScores.business = businessScore;
    }
    
    // Adjust weights for non-applicable categories
    const applicableWeights = { ...weights };
    let totalWeight = 0;
    
    Object.keys(weights).forEach(category => {
      if (subScores[category] === 100 && 
          ((category === 'home' && !profileData.primaryResidence) ||
           (category === 'auto' && !hasAutoInsurance) ||
           (category === 'umbrella' && netWorth < 500000) ||
           (category === 'business' && !isSelfEmployed))) {
        applicableWeights[category] = 0;
      } else {
        totalWeight += applicableWeights[category];
      }
    });
    
    // Normalize weights
    if (totalWeight > 0) {
      Object.keys(applicableWeights).forEach(category => {
        applicableWeights[category] = applicableWeights[category] / totalWeight;
      });
    }
    
    // Calculate weighted total score
    let totalScore = 0;
    const breakdown: Record<string, any> = {};
    
    Object.keys(subScores).forEach(category => {
      const score = subScores[category];
      const weight = applicableWeights[category];
      totalScore += score * weight;
      
      breakdown[category] = {
        score: Math.round(score),
        weight: Math.round(weight * 100),
        weighted: Math.round(score * weight)
      };
    });
    
    console.log('=== INSURANCE ADEQUACY SCORE (IAS) ===');
    console.log('Household Type:', isMarriedOrPartnered ? 'Married/Partnered' : 'Single');
    console.log('Sub-scores:', subScores);
    console.log('Weights:', applicableWeights);
    console.log('Total IAS:', Math.round(totalScore));
    console.log('Breakdown:', breakdown);
    
    return {
      score: Math.round(totalScore),
      breakdown,
      subScores
    };
  };
  
  const insuranceResult = calculateInsuranceAdequacyScore();
  const insuranceScore = insuranceResult.score;

  // Calculate composite Financial Health Score
  const healthScore = Math.round(
    0.25 * netWorthScore +
    0.20 * emergencyScore +
    0.20 * dtiScore +
    0.20 * savingsRateScore +
    0.15 * insuranceScore
  );

  // DISABLED: ARRS calculation on every profile load causes performance issues
  // Users should trigger this calculation manually via the dedicated endpoint
  // const arrsResult = calculateARRS(profileData);
  // const retirementScore = arrsResult.score;
  // const retirementAssets = arrsResult.details.currentAssets;
  
  // Get Monte Carlo simulation results if available
  let retirementScore = 0; // Default if not calculated yet
  
  const stored = profileData.monteCarloSimulation?.retirementSimulation?.results;
  if (stored) {
    if (typeof stored.probabilityOfSuccess === 'number' && stored.probabilityOfSuccess > 1) {
      // Already a percentage (0-100)
      retirementScore = Math.round(stored.probabilityOfSuccess);
    } else if (typeof stored.successProbability === 'number') {
      // Convert from 0-1 decimal to percentage
      retirementScore = Math.round(stored.successProbability * 100);
    } else if (typeof stored.probabilityOfSuccess === 'number') {
      // Legacy: might be 0-1 decimal, convert to percentage
      retirementScore = Math.round(stored.probabilityOfSuccess * 100);
    }
    console.log('Using stored Monte Carlo retirement score:', retirementScore);
  } else {
    console.log('No Monte Carlo simulation results found, using default score of 0');
  }
  const retirementAssets = assets
    .filter((asset: any) => 
      asset.type?.toLowerCase().includes('401k') || 
      asset.type?.toLowerCase().includes('ira') || 
      asset.type?.toLowerCase().includes('403b') || 
      asset.type?.toLowerCase().includes('pension') ||
      asset.type?.toLowerCase().includes('retirement')
    )
    .reduce((sum: number, asset: any) => sum + (asset.value || 0), 0);
  const recommendedRetirement = annualIncome * 10; // Keep for backward compatibility

  // Calculate risk management score (based on insurance adequacy)
  let riskManagementScore = insuranceScore; // Reuse insurance score for risk management

  // EMERGENCY READINESS SCORE (ERS) - CFP Board aligned
  const emergencyReadinessScore = calculateERS({
    EF_bal: emergencyFund,
    M_exp: totalExpenses,
    Job_var: profileData.employmentStatus === 'self-employed' || profileData.employmentStatus === 'freelance' ? 'variable' : 'stable',
    HH_type: profileData.maritalStatus === 'married' && (profileData.spouseEmploymentStatus && profileData.spouseAnnualIncome > 0) ? 'dual' : 'single',
    N_dep: profileData.dependents || 0,
    Ins_health: hasHealthInsurance,
    Ins_disab: hasDisabilityInsurance,
    Ins_home: (profileData.insurance as any)?.home || false,
    Avail_credit: calculateAvailableCredit(profileData.liabilities || []),
    Util_rate: calculateCreditUtilization(profileData.liabilities || []),
    Plan_doc: (profileData.estatePlanning as any)?.hasWill && (profileData.estatePlanning as any)?.hasPowerOfAttorney
  });

  // Get age for recommendations
  const age = profileData.dateOfBirth 
    ? new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear()
    : 35;

  // Generate personalized recommendations
  const recommendations = generatePersonalizedRecommendations(profileData, {
    healthScore,
    netWorthScore,
    emergencyScore,
    dtiScore,
    savingsRateScore,
    insuranceScore,
    retirementScore,
    arrsDetails: null, // Calculated on-demand via separate endpoint
    dtiRatio,
    savingsRate,
    emergencyMonths,
    monthlyCashFlow,
    totalAssets,
    totalLiabilities,
    annualIncome,
    age,
    hasHealthInsurance,
    hasDisabilityInsurance,
    retirementAssets,
    emergencyFund,
    totalExpenses,
    essentialExpenses,
    riskProfile,
    targetAllocation,
    estateDocuments
  });

  // Generate comprehensive AI-powered insights using all dashboard data
  let aiEnhancedRecommendations = recommendations;
  try {
    const aiInsights = await generateComprehensiveInsights(profileData, {
      healthScore,
      netWorthScore,
      emergencyScore,
      dtiScore,
      savingsRateScore,
      insuranceScore,
      retirementScore,
      arrsDetails: null, // Calculated on-demand via separate endpoint
      dtiRatio,
      savingsRate,
      emergencyMonths,
      monthlyCashFlow,
      totalAssets,
      totalLiabilities,
      annualIncome,
      age,
      riskProfile,
      targetAllocation,
      recommendations,
      estateDocuments
    });
    
    // Merge AI insights with existing recommendations
    if (aiInsights && aiInsights.length > 0) {
      aiEnhancedRecommendations = [...aiInsights, ...recommendations.slice(0, 3)];
    }
  } catch (error) {
    console.log('Error generating AI insights for dashboard:', error);
    // Fall back to existing recommendations
  }

  // Calculate optimal retirement age
  let optimalRetirementAge = null;
  try {
    // Only calculate if Step 11 has minimum required fields
    if (isStep11SufficientForOptimalAge(profileData)) {
      console.log('Calculating optimal retirement age for dashboard...');
      optimalRetirementAge = await findOptimalRetirementAge(profileData, 80); // Target 80% success rate
      if (optimalRetirementAge) {
        console.log('Optimal retirement age calculated:', optimalRetirementAge);
      }
    } else {
      console.log('Skipping optimal retirement age calculation for dashboard - Step 11 incomplete');
    }
  } catch (error) {
    console.error('Error calculating optimal retirement age:', error);
    // Continue without optimal retirement age data
  }

  return {
    netWorth: Number(netWorth) || 0,
    monthlyCashFlow: Number(monthlyCashFlow) || 0,
    healthScore: Math.min(100, Math.max(0, healthScore)),
    totalAssets: Number(totalAssets) || 0,
    totalLiabilities: Number(totalLiabilities) || 0,
    homeEquity,
    emergencyScore: Math.round(emergencyScore),
    emergencyMonths: Math.round(emergencyMonths * 10) / 10,
    retirementScore: Math.round(retirementScore),
    retirementAssets: Math.round(retirementAssets),
    recommendedRetirement: Math.round(recommendedRetirement),
    riskManagementScore: Math.round(riskManagementScore),
    dtiRatio: Math.round(dtiRatio * 10) / 10,
    savingsRate: Math.round(savingsRate * 10) / 10,
    riskProfile,
    riskScore,
    targetAllocation,
    spouseRiskProfile,
    spouseRiskScore,
    spouseTargetAllocation,
    emergencyReadinessScoreCFP: emergencyReadinessScore,
    recommendations: aiEnhancedRecommendations,
    arrsDetails: null, // Calculated on-demand via separate endpoint
    // Breakdown scores for display
    breakdown: {
      netWorthScore: Math.round(netWorthScore),
      emergencyFundScore: Math.round(emergencyScore),
      dtiScore: Math.round(dtiScore),
      savingsRateScore: Math.round(savingsRateScore),
      insuranceScore: Math.round(insuranceScore)
    },
    // Insurance Adequacy Score (IAS) details
    insuranceAdequacy: {
      score: insuranceResult.score,
      breakdown: insuranceResult.breakdown,
      subScores: insuranceResult.subScores
    },
    // Optimal retirement age analysis
    optimalRetirementAge,
    // Optimal Social Security claiming ages
    optimalSocialSecurityAge: ssOptimization.user?.optimalAge,
    optimalSpouseSocialSecurityAge: ssOptimization.spouse?.optimalAge,
    socialSecurityOptimization: {
      user: ssOptimization.user,
      spouse: ssOptimization.spouse
    }
  };
}

// Generate personalized recommendations based on financial profile analysis
function generatePersonalizedRecommendations(profileData: any, metrics: any) {
  const recommendations = [];
  
  // User's personal context
  const userName = profileData.firstName || "there";
  const age = profileData.dateOfBirth 
    ? new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear()
    : 30;
  const hasSpouse = profileData.maritalStatus === 'married';
  const hasDependents = profileData.dependents > 0;
  const employmentType = profileData.employmentStatus;
  const monthlyIncome = metrics.annualIncome / 12;
  
  // PRIORITY 1: Long-Term Care Insurance (if missing)
  const hasLTC = profileData.hasLongTermCareInsurance;
  const spouseHasLTC = profileData.spouseHasLongTermCareInsurance;
  
  if (!hasLTC && age >= 45) {
    recommendations.push({
      title: `${userName}, Protect Against Long-Term Care Costs`,
      description: `You don't have long-term care insurance. With healthcare costs rising 4.5-7% annually, LTC expenses can devastate retirement savings. At age ${age}, premiums are still affordable. The average LTC event costs $100,000+ and 70% of people over 65 need some form of care.`,
      impact: "Critical",
      category: "Insurance Protection",
      priority: 1,
      potentialImprovement: 8,
      actionSteps: [
        `Get quotes for LTC insurance with $150-200/day benefit`,
        `Consider hybrid LTC/life insurance policies for flexibility`,
        `Act now - premiums increase 3-5% for each year you wait`,
        hasSpouse && !spouseHasLTC ? `Also get coverage for your spouse` : `Review elimination period options (90 days typical)`
      ]
    });
  }
  
  if (hasSpouse && !spouseHasLTC && profileData.spouseDateOfBirth) {
    const spouseAge = new Date().getFullYear() - new Date(profileData.spouseDateOfBirth).getFullYear();
    if (spouseAge >= 45) {
      recommendations.push({
        title: `Get LTC Insurance for Your Spouse`,
        description: `Your spouse doesn't have long-term care insurance. At age ${spouseAge}, they should secure coverage now while premiums are affordable. Couples often get discounts when both apply together.`,
        impact: "Critical",
        category: "Insurance Protection", 
        priority: 1,
        potentialImprovement: 6,
        actionSteps: [
          `Get quotes for spouse LTC coverage`,
          `Consider shared care riders for flexibility`,
          `Look for spousal discounts (typically 10-30% off)`
        ]
      });
    }
  }
  
  // PRIORITY 2: Maximize Retirement Contributions (if positive cash flow)
  const contributionOpportunities = analyzeRetirementContributionOpportunities(profileData, metrics);
  
  if (contributionOpportunities.length > 0 && metrics.monthlyCashFlow > 500) {
    // Add recommendations for top 2 opportunities
    contributionOpportunities.slice(0, 2).forEach((opp, index) => {
      recommendations.push({
        title: `${userName}, ${opp.account === 'Solo 401(k)' ? 'Open' : opp.account.includes('Increase') ? 'Maximize' : 'Start'} ${opp.account}`,
        description: opp.description + ` With your monthly cash flow of $${metrics.monthlyCashFlow.toLocaleString()}, you can afford this contribution while maintaining your lifestyle.`,
        impact: opp.impact,
        category: "Retirement Savings",
        priority: 2 + index,
        potentialImprovement: opp.impact === 'Very High' ? 10 : 7,
        actionSteps: [
          opp.account.includes('IRA') ? 
            `Open account with low-cost provider (Vanguard, Fidelity, Schwab)` :
            opp.account.includes('Solo') ?
            `Research Solo 401(k) providers for self-employed` :
            `Contact HR to increase contribution percentage`,
          `Set up automatic monthly contribution of $${Math.round(opp.recommendedContribution / 12).toLocaleString()}`,
          age >= 50 ? `Take advantage of catch-up contributions` : `Increase by 1% annually`,
          `Invest in low-cost index funds matching your risk profile`
        ]
      });
    });
  }
  
  // 3. Emergency Fund Priority (if score < 75) - Now priority 3 after LTC and retirement  
  if (metrics.emergencyScore < 75) {
    // Target 3 months first if below that, then 6 months for excellence
    const targetMonths = metrics.emergencyMonths < 3 ? 3 : 6;
    const neededEmergency = (metrics.essentialExpenses * targetMonths) - metrics.emergencyFund;
    const monthsToSave = Math.ceil(neededEmergency / Math.max(metrics.monthlyCashFlow, 100));
    
    // Personalize based on family situation
    const familyContext = hasDependents ? 
      `With ${profileData.dependents} dependent${profileData.dependents > 1 ? 's' : ''}, having a robust emergency fund is crucial for your family's security.` :
      hasSpouse ? 
      `As a married couple, coordinate with your spouse to build this safety net together.` :
      `Building this fund will give you peace of mind and financial flexibility.`;
    
    // Personalize based on employment status
    const employmentContext = employmentType === 'self-employed' || employmentType === 'freelance' ?
      `As a ${employmentType} professional with variable income, aim for 9-12 months of expenses instead of the standard 6 months.` :
      ``;
    
    recommendations.push({
      title: `${userName}, Build Your Emergency Fund`,
      description: `You currently have $${metrics.emergencyFund.toLocaleString()} saved, covering ${metrics.emergencyMonths.toFixed(1)} months. ${targetMonths === 3 ? `Build to ${targetMonths}-month foundation` : `Expand to ${targetMonths}-month cushion`} by adding $${neededEmergency.toLocaleString()}. ${familyContext} ${employmentContext}`,
      impact: "High",
      category: "Emergency Planning",
      priority: 1,
      potentialImprovement: Math.min(25, (75 - metrics.emergencyScore)),
      actionSteps: [
        `Set up automatic transfer of $${Math.ceil(neededEmergency / 24).toLocaleString()} biweekly to a high-yield savings account`,
        `Based on your current cash flow of $${metrics.monthlyCashFlow.toLocaleString()}/month, allocate ${Math.min(50, Math.ceil((neededEmergency/monthsToSave)/metrics.monthlyCashFlow * 100))}% to emergency savings`,
        employmentType === 'self-employed' ? "Save 30% of each client payment before spending" : "Use your next bonus or tax refund to jumpstart the fund"
      ]
    });
  }

  // 2. Debt Reduction (if DTI > 30%)
  if (metrics.dtiRatio > 30) {
    const excessDebt = (metrics.dtiRatio - 20) / 100 * metrics.annualIncome / 12;
    
    // Analyze specific debt types
    const debts = profileData.liabilities || [];
    const highInterestDebts = debts.filter((d: any) => d.interestRate > 15);
    const creditCardDebt = debts.filter((d: any) => d.type === 'credit_card').reduce((sum: number, d: any) => sum + (d.balance || 0), 0);
    const studentLoans = debts.filter((d: any) => d.type === 'student_loan').reduce((sum: number, d: any) => sum + (d.balance || 0), 0);
    
    // Personalized debt strategy
    let debtStrategy = "";
    if (creditCardDebt > 0) {
      debtStrategy = `You have $${creditCardDebt.toLocaleString()} in credit card debt. Focus on eliminating this first due to high interest rates. `;
    }
    if (studentLoans > 0 && age < 35) {
      debtStrategy += `Your $${studentLoans.toLocaleString()} in student loans can be managed strategically - consider income-driven repayment if eligible.`;
    }
    
    recommendations.push({
      title: `${userName}, Optimize Your Debt Strategy`,
      description: `Your debt-to-income ratio of ${metrics.dtiRatio.toFixed(1)}% is above the recommended 30%. ${debtStrategy} By reducing monthly debt payments by $${excessDebt.toLocaleString()}, you could free up $${(excessDebt * 12).toLocaleString()} annually for savings and investments.`,
      impact: "High",
      category: "Debt Management",
      priority: metrics.emergencyScore < 30 ? 2 : 1,
      potentialImprovement: Math.min(20, (metrics.dtiRatio - 20) * 0.5),
      actionSteps: [
        highInterestDebts.length > 0 ? 
          `Pay off your ${highInterestDebts.length} high-interest debt${highInterestDebts.length > 1 ? 's' : ''} first (${highInterestDebts.map((d: any) => `${d.type}: ${d.interestRate}%`).join(', ')})` :
          "List all debts by interest rate (avalanche method)",
        creditCardDebt > 5000 ? "Consider a balance transfer to a 0% APR card" : "Negotiate lower rates with creditors",
        `With your cash flow of $${metrics.monthlyCashFlow.toLocaleString()}/month, aim to pay an extra $${Math.min(metrics.monthlyCashFlow * 0.3, excessDebt).toLocaleString()} toward principal`
      ]
    });
  }

  // 3. Retirement Planning - Aligned with Monte Carlo Results
  // DISABLED: Monte Carlo calculation on every profile load causes performance issues
  // Users should trigger this calculation manually when needed
  let monteCarloSuccess = null;
  /*
  try {
    const retirementParams = profileToRetirementParams(profileData);
    const monteCarloResult = runRightCapitalStyleMonteCarloSimulation(retirementParams, 2500);
    monteCarloSuccess = monteCarloResult.probabilityOfSuccess;
  } catch (error) {
    console.log('Could not calculate Monte Carlo for recommendations');
  }
  */
  
  // Base retirement recommendations on Monte Carlo success rate
  if (monteCarloSuccess !== null) {
    if (monteCarloSuccess < 65) {
      // LOW SUCCESS: Critical improvements needed
      const yearsToRetirement = Math.max(0, 65 - age);
      const monthlyNeeded = Math.ceil(metrics.monthlyCashFlow * 0.3); // Suggest saving 30% of cash flow
      
      recommendations.push({
        title: `${userName}, Improve Your Retirement Outlook`,
        description: `Your Monte Carlo simulation shows a ${monteCarloSuccess.toFixed(0)}% probability of meeting your retirement goals. This needs immediate attention. You have $${metrics.retirementAssets.toLocaleString()} saved. Increasing contributions by $${monthlyNeeded.toLocaleString()}/month can significantly improve your retirement security.`,
        impact: "High",
        category: "Retirement Planning",
        priority: 2,
        potentialImprovement: Math.min(25, (80 - monteCarloSuccess) * 0.5),
        actionSteps: [
          `Increase retirement contributions by at least $${monthlyNeeded.toLocaleString()}/month`,
          "Consider delaying retirement by 1-2 years to improve success rate",
          "Review and potentially reduce planned retirement expenses",
          age >= 50 ? "Maximize catch-up contributions ($7,500 extra)" : "Start with employer match if available"
        ]
      });
    } else if (monteCarloSuccess < 80) {
      // MODERATE SUCCESS: Improvements recommended
      recommendations.push({
        title: `${userName}, Strengthen Your Retirement Plan`,
        description: `Your Monte Carlo simulation shows a ${monteCarloSuccess.toFixed(0)}% probability of meeting your retirement goals. While you're on track, there's room for improvement. You have $${metrics.retirementAssets.toLocaleString()} saved. Small increases in savings can push you into the "highly confident" range.`,
        impact: "Medium",
        category: "Retirement Planning",
        priority: 3,
        potentialImprovement: Math.min(15, (85 - monteCarloSuccess) * 0.3),
        actionSteps: [
          "Increase contributions by 1-2% of salary annually",
          "Consider Roth conversions in low-income years",
          "Review asset allocation for optimal risk/return balance",
          "Explore additional income streams for retirement"
        ]
      });
    } else {
      // HIGH SUCCESS: Focus on optimization
      recommendations.push({
        title: `${userName}, Optimize Your Strong Retirement Position`,
        description: `Excellent news! Your Monte Carlo simulation shows a ${monteCarloSuccess.toFixed(0)}% probability of meeting your retirement goals. With $${metrics.retirementAssets.toLocaleString()} saved, you're well-positioned. Focus on tax optimization and legacy planning.`,
        impact: "Low",
        category: "Retirement Planning",
        priority: 5,
        potentialImprovement: 5,
        actionSteps: [
          "Consider Roth conversions to reduce future tax burden",
          "Explore charitable giving strategies for tax benefits",
          "Review estate planning to maximize legacy goals",
          "Consider retiring earlier or increasing retirement lifestyle budget"
        ]
      });
    }
  } else if (metrics.retirementScore < 70) {
    // Fallback to original logic if Monte Carlo not available
    const yearsToRetirement = Math.max(0, 65 - age);
    const ageBasedTarget = yearsToRetirement > 20 ? metrics.annualIncome : metrics.annualIncome * 10;
    const retirementGap = ageBasedTarget - metrics.retirementAssets;
    const monthlyNeeded = retirementGap / Math.max(1, yearsToRetirement * 12);
    
    // Age-specific guidance
    let ageGuidance = "";
    if (age < 30) {
      ageGuidance = `At ${age}, you have time on your side. Even small contributions will compound significantly over ${yearsToRetirement} years.`;
    } else if (age < 45) {
      ageGuidance = `At ${age}, you're in your peak earning years. This is the critical time to accelerate retirement savings.`;
    } else {
      ageGuidance = `At ${age}, focus on catch-up contributions and maximizing tax-advantaged accounts.`;
    }
    
    // Employment-specific advice
    const has401k = profileData.retirementAccounts?.includes('401k');
    const employerMatch = has401k ? "Your employer's 401(k) match is free money - ensure you're contributing at least enough to get the full match." : "";
    
    recommendations.push({
      title: `${userName}, Secure Your Retirement Future`,
      description: `You currently have $${metrics.retirementAssets.toLocaleString()} saved for retirement. ${ageGuidance} Increase contributions by $${Math.min(monthlyNeeded, metrics.monthlyCashFlow * 0.5).toLocaleString()}/month to be on track for a comfortable retirement. ${employerMatch}`,
      impact: "Medium",
      category: "Retirement Planning",
      priority: 3,
      potentialImprovement: Math.min(15, (70 - metrics.retirementScore) * 0.3),
      actionSteps: [
        has401k ? 
          `Increase your 401(k) contribution to ${Math.min(20, Math.ceil((monthlyNeeded * 12) / metrics.annualIncome * 100))}% of your salary` :
          `Open a ${age < 50 || metrics.annualIncome < 150000 ? "Roth" : "Traditional"} IRA and contribute $${Math.min(6500, monthlyNeeded * 12).toLocaleString()}/year`,
        age >= 50 ? "Take advantage of $7,500 catch-up contributions" : "Set up automatic annual 1% contribution increases",
        `Based on your ${metrics.riskProfile || 'moderate'} risk profile, invest in a ${age < 40 ? "90/10" : age < 50 ? "80/20" : "70/30"} stocks/bonds allocation`
      ]
    });
  }

  // 4. Insurance Coverage (if insurance score < 80)
  if (metrics.insuranceScore < 80) {
    let missingCoverage = [];
    let specificNeeds = [];
    const isMarriedOrPartnered = profileData.maritalStatus === 'married' || profileData.maritalStatus === 'domestic_partnership';
    const spouseIncome = Number(profileData.spouseAnnualIncome) || 0;
    const spouseName = profileData.spouseName || 'your spouse';
    const spouseAge = profileData.spouseDateOfBirth ? 
      new Date().getFullYear() - new Date(profileData.spouseDateOfBirth).getFullYear() : age;
    
    // Health Insurance Check
    if (!(profileData.healthInsurance?.hasHealthInsurance)) {
      missingCoverage.push("health insurance");
      specificNeeds.push(`Without health insurance, a single medical emergency could cost $${(50000).toLocaleString()}+`);
    }
    
    // Disability Insurance Check - User
    if (!(profileData.disabilityInsurance?.hasDisability) && age < 60 && profileData.employmentStatus !== 'retired' && metrics.annualIncome > 0) {
      missingCoverage.push("disability insurance for you");
      specificNeeds.push(`Your income of $${metrics.annualIncome.toLocaleString()}/year needs protection - you're ${60-age} years from retirement`);
    }
    
    // Disability Insurance Check - Spouse (if married and working)
    if (isMarriedOrPartnered && spouseIncome > 0 && spouseAge < 60 && 
        (!profileData.spouseDisabilityInsurance?.hasDisability) && 
        profileData.spouseEmploymentStatus !== 'retired') {
      missingCoverage.push(`disability insurance for ${spouseName}`);
      specificNeeds.push(`${spouseName}'s income of $${spouseIncome.toLocaleString()}/year also needs protection`);
    }
    
    // Life Insurance Check - User
    if ((hasDependents || isMarriedOrPartnered) && metrics.annualIncome > 0) {
      const userLifeInsurance = profileData.lifeInsurance?.coverageAmount || 0;
      const userNeededCoverage = metrics.annualIncome * 10;
      if (!profileData.lifeInsurance?.hasPolicy || userLifeInsurance < userNeededCoverage) {
        const userCoverageGap = userNeededCoverage - userLifeInsurance;
        missingCoverage.push("adequate life insurance for you");
        specificNeeds.push(`You need $${userCoverageGap.toLocaleString()} more in life insurance coverage`);
      }
    }
    
    // Life Insurance Check - Spouse (if married with income)
    if (isMarriedOrPartnered && spouseIncome > 0 && (hasDependents || metrics.annualIncome > 0)) {
      const spouseLifeInsurance = profileData.spouseLifeInsurance?.coverageAmount || 0;
      const spouseNeededCoverage = spouseIncome * 10;
      if (!profileData.spouseLifeInsurance?.hasPolicy || spouseLifeInsurance < spouseNeededCoverage) {
        const spouseCoverageGap = spouseNeededCoverage - spouseLifeInsurance;
        missingCoverage.push(`adequate life insurance for ${spouseName}`);
        specificNeeds.push(`${spouseName} needs $${spouseCoverageGap.toLocaleString()} more in life insurance coverage`);
      }
    }
    
    // Long-term Care Insurance Check - handled separately in personalized recommendations
    // Not added to missingCoverage to avoid duplication
    
    // Personalized insurance context
    let familyContext = "";
    if (hasDependents && isMarriedOrPartnered) {
      familyContext = `With ${profileData.dependents} dependent${profileData.dependents > 1 ? 's' : ''} and a spouse, comprehensive household insurance coverage is critical.`;
    } else if (hasDependents) {
      familyContext = `With ${profileData.dependents} dependent${profileData.dependents > 1 ? 's' : ''}, protecting your family's financial future is essential.`;
    } else if (isMarriedOrPartnered) {
      familyContext = `As a married couple, ensure both you and ${spouseName} have adequate coverage to protect each other financially.`;
    } else {
      familyContext = `Protecting your income and health is crucial for maintaining financial independence.`;
    }
    
    // Build action steps based on household needs
    let actionSteps = [];
    
    // Health insurance action
    if (missingCoverage.some(c => c.includes("health insurance"))) {
      actionSteps.push("Explore marketplace options or employer coverage immediately for the entire household");
    } else {
      actionSteps.push("Review and ensure all family members are adequately covered under health insurance");
    }
    
    // Disability insurance actions
    const needsUserDisability = missingCoverage.some(c => c.includes("disability insurance for you"));
    const needsSpouseDisability = missingCoverage.some(c => c.includes(`disability insurance for ${spouseName}`));
    
    if (needsUserDisability && needsSpouseDisability) {
      actionSteps.push(`Get disability insurance quotes for both you ($${monthlyIncome.toLocaleString()}/month) and ${spouseName} ($${(spouseIncome/12).toLocaleString()}/month)`);
    } else if (needsUserDisability) {
      actionSteps.push(`Get disability insurance quotes to protect your $${monthlyIncome.toLocaleString()}/month income`);
    } else if (needsSpouseDisability) {
      actionSteps.push(`Get disability insurance quotes for ${spouseName} to protect their $${(spouseIncome/12).toLocaleString()}/month income`);
    } else if (age < 60 || (isMarriedOrPartnered && spouseAge < 60)) {
      actionSteps.push("Review existing disability coverage to ensure it equals 60-70% of household income");
    }
    
    // Life insurance actions
    const needsUserLife = missingCoverage.some(c => c.includes("adequate life insurance for you"));
    const needsSpouseLife = missingCoverage.some(c => c.includes(`adequate life insurance for ${spouseName}`));
    
    // Calculate current coverage and gaps for accurate action steps
    const userLifeInsurance = profileData.lifeInsurance?.coverageAmount || 0;
    const userNeededCoverage = metrics.annualIncome * 10;
    const userCoverageGap = userNeededCoverage - userLifeInsurance;
    
    const spouseLifeInsurance = profileData.spouseLifeInsurance?.coverageAmount || 0;
    const spouseNeededCoverage = spouseIncome * 10;
    const spouseCoverageGap = spouseNeededCoverage - spouseLifeInsurance;
    
    if (needsUserLife && needsSpouseLife) {
      if (userLifeInsurance > 0 || spouseLifeInsurance > 0) {
        actionSteps.push(`Increase life insurance coverage: You need $${userCoverageGap.toLocaleString()} more (total: $${userNeededCoverage.toLocaleString()}) and ${spouseName} needs $${spouseCoverageGap.toLocaleString()} more (total: $${spouseNeededCoverage.toLocaleString()})`);
      } else {
        actionSteps.push(`Get term life insurance quotes: You need $${userNeededCoverage.toLocaleString()} and ${spouseName} needs $${spouseNeededCoverage.toLocaleString()} (10x annual income each)`);
      }
    } else if (needsUserLife) {
      if (userLifeInsurance > 0) {
        actionSteps.push(`Increase your life insurance by $${userCoverageGap.toLocaleString()} to reach $${userNeededCoverage.toLocaleString()} total (10x your annual income)`);
      } else {
        actionSteps.push(`Get term life insurance quotes for $${userNeededCoverage.toLocaleString()} coverage (10x your annual income)`);
      }
    } else if (needsSpouseLife) {
      if (spouseLifeInsurance > 0) {
        actionSteps.push(`Increase ${spouseName}'s life insurance by $${spouseCoverageGap.toLocaleString()} to reach $${spouseNeededCoverage.toLocaleString()} total (10x their annual income)`);
      } else {
        actionSteps.push(`Get term life insurance quotes for ${spouseName}: $${spouseNeededCoverage.toLocaleString()} coverage (10x their annual income)`);
      }
    } else if (hasDependents || isMarriedOrPartnered) {
      actionSteps.push("Review and potentially increase existing life insurance coverage as income grows");
    }
    
    recommendations.push({
      title: `${userName}, Close Your Household Insurance Gaps`,
      description: `${familyContext} You're missing critical coverage: ${missingCoverage.join(", ")}. ${specificNeeds.join(". ")}.`,
      impact: "Medium",
      category: "Risk Management",
      priority: 4,
      potentialImprovement: Math.min(15, (80 - metrics.insuranceScore) * 0.4),
      actionSteps: actionSteps
    });
  }

  // 5. Investment Optimization (always applicable)
  const currentStocks = (profileData.currentAllocation?.usStocks || 0) + (profileData.currentAllocation?.intlStocks || 0);
  const targetStocks = (metrics.targetAllocation?.usStocks || 0) + (metrics.targetAllocation?.intlStocks || 0);
  const allocationGap = Math.abs(currentStocks - targetStocks);
  
  if (allocationGap > 10 || metrics.totalAssets > 10000) {
    // Analyze current vs target allocation
    const overweightStocks = currentStocks > targetStocks;
    const investableAssets = metrics.totalAssets - metrics.emergencyFund;
    
    // Age and goal-based context
    let investmentContext = "";
    if (age < 35) {
      investmentContext = `At ${age}, you can afford to take more risk for higher long-term returns.`;
    } else if (age > 55) {
      investmentContext = `At ${age}, consider gradually shifting to more conservative investments as you approach retirement.`;
    } else {
      investmentContext = `Your investment timeline allows for a balanced approach to growth and stability.`;
    }
    
    // Specific allocation advice
    const currentAllocation = profileData.currentAllocation || {};
    const targetAllocation = metrics.targetAllocation || {};
    let rebalanceSteps = [];
    
    if (currentAllocation.cash > targetAllocation.cash + 10) {
      rebalanceSteps.push(`Reduce cash allocation from ${currentAllocation.cash}% to ${targetAllocation.cash}% - you have $${(investableAssets * (currentAllocation.cash - targetAllocation.cash) / 100).toLocaleString()} excess in cash`);
    }
    if (Math.abs(currentStocks - targetStocks) > 10) {
      rebalanceSteps.push(`${overweightStocks ? 'Reduce' : 'Increase'} stock allocation from ${currentStocks}% to ${targetStocks}% to match your ${metrics.riskProfile} risk profile`);
    }
    
    recommendations.push({
      title: `${userName}, Optimize Your Investment Portfolio`,
      description: `Your current allocation doesn't match your ${metrics.riskProfile} risk profile and ${Math.max(0, 65 - age) || 30}-year timeline. ${investmentContext} You have $${investableAssets.toLocaleString()} to invest after emergency funds.`,
      impact: "Medium",
      category: "Investment Strategy",
      priority: 5,
      potentialImprovement: Math.min(10, allocationGap * 0.2),
      actionSteps: rebalanceSteps.length > 0 ? rebalanceSteps : [
        `Target allocation for your profile: ${targetStocks}% stocks, ${targetAllocation.bonds || 0}% bonds, ${targetAllocation.alternatives || 0}% alternatives`,
        investableAssets > 50000 ? 
          "Consider a robo-advisor or fee-only financial advisor for professional rebalancing" :
          "Use low-cost target-date funds or balanced index funds",
        `Set up automatic rebalancing ${metrics.totalAssets > 100000 ? 'quarterly' : 'annually'} to maintain target allocation`
      ]
    });
  }

  // 6. Goal-specific recommendations
  if (profileData.goals && profileData.goals.length > 0) {
    const primaryGoal = profileData.goals[0];
    const goalAmount = primaryGoal.targetAmount || 0;
    const goalTimeline = primaryGoal.timeline || 5;
    const monthlySavingsNeeded = goalAmount / (goalTimeline * 12);
    
    if (monthlySavingsNeeded > metrics.monthlyCashFlow * 0.1) {
      recommendations.push({
        title: `${userName}, Achieve Your ${primaryGoal.name} Goal`,
        description: `To reach your $${goalAmount.toLocaleString()} ${primaryGoal.name} goal in ${goalTimeline} years, save $${monthlySavingsNeeded.toLocaleString()}/month. This represents ${Math.round(monthlySavingsNeeded / metrics.monthlyCashFlow * 100)}% of your current cash flow.`,
        impact: "Medium",
        category: "Goal Planning",
        priority: 6,
        potentialImprovement: 10,
        actionSteps: [
          `Open a dedicated savings account for your ${primaryGoal.name} goal`,
          `Automate $${Math.ceil(monthlySavingsNeeded / 2).toLocaleString()} transfers biweekly`,
          goalTimeline <= 3 ? "Keep funds in high-yield savings or short-term bonds" : "Consider moderate-risk investments for better returns"
        ]
      });
    }
  }

  // 7. Tax optimization (for high earners)
  const isMarriedOrPartnered = profileData.maritalStatus === 'married' || profileData.maritalStatus === 'domestic_partnership';
  // Note: metrics.annualIncome already includes both user and spouse income (calculated in line 717)
  const householdIncome = metrics.annualIncome;
  const incomeThreshold = isMarriedOrPartnered ? 150000 : 100000;
  
  if (householdIncome > incomeThreshold) {
    const estimatedTaxSavings = householdIncome * 0.05; // Rough estimate
    const householdContext = isMarriedOrPartnered ? 
      ` combined household income of $${householdIncome.toLocaleString()}` :
      ` income of $${householdIncome.toLocaleString()}`;
    
    let taxActionSteps = [
      "Max out 401(k) contributions ($22,500/year per person) for immediate tax deduction"
    ];
    
    if (isMarriedOrPartnered) {
      taxActionSteps.push("Coordinate with spouse to maximize both 401(k) contributions for $45,000 total deduction");
      taxActionSteps.push("Consider spousal IRA contributions and filing strategies for maximum benefit");
    } else {
      taxActionSteps.push(householdIncome > 200000 ? "Explore backdoor Roth IRA conversions" : "Max out traditional or Roth IRA contributions");
    }
    
    taxActionSteps.push("Track deductible expenses and consider bunching strategies");
    
    recommendations.push({
      title: `${userName}, Optimize Your${isMarriedOrPartnered ? ' Household' : ''} Tax Strategy`,
      description: `With your${householdContext}, strategic tax planning could save you approximately $${estimatedTaxSavings.toLocaleString()} annually. ${isMarriedOrPartnered ? 'Coordinate with your spouse to ' : ''}Focus on maximizing tax-advantaged accounts and deductions.`,
      impact: "Medium",
      category: "Tax Planning",
      priority: 7,
      potentialImprovement: 8,
      actionSteps: taxActionSteps
    });
  }

  // 8. Estate Planning (for significant assets or family situations)
  const hasWill = profileData.hasWill || false;
  const hasTrust = profileData.hasTrust || false;
  const hasPowerOfAttorney = profileData.hasPowerOfAttorney || false;
  const hasHealthcareProxy = profileData.hasHealthcareProxy || false;
  const hasBeneficiaries = profileData.hasBeneficiaries || false;
  
  // Check for parsed estate document insights
  const estateDocsWithInsights = metrics.estateDocuments?.filter((doc: any) => doc.parsedInsights) || [];
  const hasUploadedDocuments = estateDocsWithInsights.length > 0;
  
  const estatePlanningDocuments = [hasWill, hasTrust, hasPowerOfAttorney, hasHealthcareProxy, hasBeneficiaries];
  const missingDocuments = estatePlanningDocuments.filter(doc => !doc).length;
  
  // Recommend estate planning for: high net worth, married, has dependents, or over 40
  const needsEstatePlanning = (
    metrics.netWorth > 500000 ||
    metrics.totalAssets > 750000 ||
    metrics.annualIncome > 200000 ||
    isMarriedOrPartnered ||
    hasDependents ||
    age > 40
  );
  
  if (needsEstatePlanning && missingDocuments > 0) {
    let estatePlanningContext = "";
    let urgencyLevel = "Medium";
    
    if (metrics.netWorth > 1000000 || metrics.totalAssets > 1500000) {
      estatePlanningContext = `With a net worth of $${metrics.netWorth.toLocaleString()} and total assets of $${metrics.totalAssets.toLocaleString()}, proper estate planning is critical for asset protection and tax minimization.`;
      urgencyLevel = "High";
    } else if (hasDependents && isMarriedOrPartnered) {
      estatePlanningContext = `With ${profileData.dependents} dependent${profileData.dependents > 1 ? 's' : ''} and a spouse, protecting your family's financial future requires comprehensive estate planning.`;
      urgencyLevel = "High";
    } else if (isMarriedOrPartnered) {
      estatePlanningContext = `As a married couple, estate planning ensures your assets transfer smoothly to ${profileData.spouseName || 'your spouse'} and avoids probate.`;
    } else {
      estatePlanningContext = `Estate planning ensures your wishes are followed and can significantly reduce taxes and legal complications.`;
    }
    
    let missingDocumentsList = [];
    if (!hasWill) missingDocumentsList.push("will");
    if (!hasPowerOfAttorney) missingDocumentsList.push("financial power of attorney");
    if (!hasHealthcareProxy) missingDocumentsList.push("healthcare proxy/living will");
    if (!hasBeneficiaries) missingDocumentsList.push("beneficiary designations");
    if (!hasTrust && (metrics.netWorth > 1000000 || hasDependents)) missingDocumentsList.push("revocable living trust");
    
    let actionSteps = [];
    
    // Priority action based on situation
    if (!hasWill) {
      actionSteps.push("Schedule consultation with an estate planning attorney within 30 days - this is your top priority");
    }
    
    if (metrics.netWorth > 1000000 || metrics.annualIncome > 500000) {
      actionSteps.push("Consider establishing a revocable living trust to avoid probate and maintain privacy");
      actionSteps.push("Explore advanced strategies like irrevocable life insurance trusts (ILITs) for estate tax planning");
    }
    
    if (hasDependents) {
      actionSteps.push("Name guardians for minor children in your will");
      actionSteps.push("Consider setting up education trusts for children");
    }
    
    actionSteps.push(`Complete missing documents: ${missingDocumentsList.join(", ")}`);
    actionSteps.push("Review and update beneficiaries on all accounts (401k, IRA, life insurance)");
    
    const priority = urgencyLevel === "High" ? 2 : 5; // High priority if high net worth or has dependents
    
    recommendations.push({
      title: `${userName}, Protect Your Legacy with Estate Planning`,
      description: `${estatePlanningContext} You're missing ${missingDocuments} out of 5 essential estate planning documents. Without proper planning, your assets may not be distributed according to your wishes, and your family could face unnecessary taxes and legal complications.`,
      impact: urgencyLevel,
      category: "Estate Planning",
      priority: priority,
      potentialImprovement: urgencyLevel === "High" ? 20 : 12,
      actionSteps: actionSteps
    });
  }
  
  // 9. Estate Document Review Recommendations (if documents were uploaded and parsed)
  if (hasUploadedDocuments) {
    estateDocsWithInsights.forEach((doc: any) => {
      const insights = doc.parsedInsights as any;
      
      // Check for document-specific recommendations from Gemini parsing
      if (insights.recommendations && insights.recommendations.length > 0) {
        const documentType = doc.documentType.charAt(0).toUpperCase() + doc.documentType.slice(1);
        
        recommendations.push({
          title: `${userName}, Review Your ${documentType} Recommendations`,
          description: `Based on analysis of your ${documentType}, we've identified important updates: ${insights.recommendations[0]}`,
          impact: "Medium",
          category: "Estate Planning",
          priority: 8,
          potentialImprovement: 10,
          actionSteps: [
            ...insights.recommendations.slice(0, 3),
            `Schedule a review with your estate planning attorney`,
            `Update document to reflect current family and financial situation`
          ]
        });
      }
      
      // Check for missing beneficiaries or outdated information
      if (insights.beneficiaries && insights.beneficiaries.length === 0 && doc.documentType === 'will') {
        recommendations.push({
          title: `${userName}, Update Beneficiaries in Your Will`,
          description: `Your will appears to lack specific beneficiary designations. This could lead to state laws determining asset distribution.`,
          impact: "High",
          category: "Estate Planning",
          priority: 3,
          potentialImprovement: 15,
          actionSteps: [
            "Review and specify primary beneficiaries with percentages",
            "Add contingent beneficiaries in case primary beneficiaries predecease you",
            "Consider creating a trust for minor beneficiaries",
            "Update your will with an estate planning attorney"
          ]
        });
      }
    });
  }

  // Sort by priority and potential improvement
  return recommendations
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.potentialImprovement - a.potentialImprovement;
    })
    .slice(0, 5); // Return top 5 recommendations
}

// Gemini AI integration
async function generateAIResponse(
  message: string,
  userId: number,
): Promise<string> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    // Get user's financial profile for context
    const profile = await storage.getFinancialProfile(userId);
    
    // Get estate planning documents with parsed insights
    const estateDocuments = await storage.getEstateDocuments(userId);
    const estateDocsWithInsights = estateDocuments.filter(doc => doc.parsedInsights);

    let contextPrompt = `You are AFFLUVIA AI, a CFP certified professional financial planner. You provide personalized financial advice based on the user's specific financial data and situation. `;

    if (profile) {
      const calculations = await calculateFinancialMetrics(profile, estateDocuments);
      
      const age = profile.dateOfBirth ? 
      new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : 
      null;

      // Get comprehensive dashboard widget data
      let monteCarloData = null;
      let retirementParams = null;
      let cashFlowData = null;
      
      try {
        // Get Monte Carlo retirement simulation results (enhanced engine)
        retirementParams = profileToRetirementParams(profile);
        const mcResult = await mcPool.run({ params: retirementParams, simulationCount: 1000, type: 'score' });
        monteCarloData = mcResult.fullResult;
        
        // Get cash flow projection data  
        cashFlowData = generateCashFlowData(profile, { scenarioId: 'base', percentile: 50 });
        
        console.log('Monte Carlo data for chat AI:', {
          probabilityOfSuccess: monteCarloData?.probabilityOfSuccess,
          safeWithdrawalRate: monteCarloData?.safeWithdrawalRate,
          medianEndingBalance: monteCarloData?.medianEndingBalance
        });
      } catch (error) {
        console.log('Error fetching additional widget data for AI context:', error);
      }
    
    contextPrompt += `\nUser Profile:
- Name: ${profile.firstName || 'User'}
- Age: ${age ? age : 'Not specified'}
- Marital Status: ${profile.maritalStatus || 'Not specified'}
- Dependents: ${profile.dependents || 0}
- Employment: ${profile.employmentStatus || 'Not specified'}
- State: ${profile.state || 'Not specified'}
- Spouse Info: ${profile.maritalStatus === 'married' ? `${profile.spouseName || 'Spouse'}, Age ${profile.spouseDateOfBirth ? new Date().getFullYear() - new Date(profile.spouseDateOfBirth).getFullYear() : 'Not specified'}, Income $${(profile.spouseAnnualIncome || 0).toLocaleString()}` : 'N/A'}

Complete Financial Situation:
- Net Worth: $${calculations.netWorth.toLocaleString()}
- Monthly Cash Flow: $${calculations.monthlyCashFlow.toLocaleString()}
- Financial Health Score: ${calculations.healthScore}/100
- Annual Income: $${(profile.annualIncome || 0).toLocaleString()}
- Total Assets: $${calculations.totalAssets.toLocaleString()}
- Total Liabilities: $${calculations.totalLiabilities.toLocaleString()}
- Emergency Fund: $${(profile.emergencyFundSize || 0).toLocaleString()} (${calculations.emergencyMonths?.toFixed(1) || 0} months of expenses)
- Emergency Readiness Score: ${calculations.emergencyReadinessScoreCFP || 0}/100
- Retirement Readiness Score: ${calculations.retirementScore || 0}/100
- Risk Profile: ${calculations.riskProfile || 'Not assessed'} (${calculations.riskScore}/5)
- Insurance Adequacy Score: ${calculations.insuranceAdequacy?.score || 0}/100

Detailed Monthly Expenses:
${profile.monthlyExpenses ? Object.entries(profile.monthlyExpenses).map(([category, amount]) => 
  `- ${category.charAt(0).toUpperCase() + category.slice(1)}: $${Number(amount || 0).toLocaleString()}`).join('\n') : '- No detailed expenses provided'}
- Total Monthly Expenses: $${Object.values(profile.monthlyExpenses || {}).reduce((sum, exp) => sum + Number(exp || 0), 0).toLocaleString()}

Asset Portfolio:
${profile.assets ? profile.assets.map((asset, i) => 
  `- ${asset.type}: $${Number(asset.value || 0).toLocaleString()} (${asset.owner})`).join('\n') : '- No assets listed'}

Debt Portfolio:
${profile.liabilities ? profile.liabilities.map((debt, i) => 
  `- ${debt.type}: $${Number(debt.balance || 0).toLocaleString()} @ ${debt.interestRate}% ($${Number(debt.monthlyPayment || 0).toLocaleString()}/month)`).join('\n') : '- No debts listed'}

Insurance Coverage:
- Life Insurance: ${profile.lifeInsurance?.hasPolicy ? `$${Number(profile.lifeInsurance.coverageAmount || 0).toLocaleString()}` : 'None'}
- Spouse Life Insurance: ${profile.spouseLifeInsurance?.hasPolicy ? `$${Number(profile.spouseLifeInsurance.coverageAmount || 0).toLocaleString()}` : 'None'}
- Health Insurance: ${profile.healthInsurance?.hasHealthInsurance ? `$${Number(profile.healthInsurance.monthlyPremium || 0).toLocaleString()}/month, $${Number(profile.healthInsurance.annualDeductible || 0).toLocaleString()} deductible` : 'None'}
- Disability Insurance: ${profile.disabilityInsurance?.hasDisability ? `$${Number(profile.disabilityInsurance.benefitAmount || 0).toLocaleString()}/month benefit` : 'None'}

Key Financial Metrics:
- Debt-to-Income Ratio: ${calculations.dtiRatio?.toFixed(1) || 0}%
- Savings Rate: ${calculations.savingsRate?.toFixed(1) || 0}%
- Insurance Adequacy Score: ${calculations.breakdown?.insuranceScore || 0}/100

${monteCarloData && retirementParams ? `
Monte Carlo Retirement Analysis (1,000 Scenarios):
Input Parameters:
- Current Age: ${retirementParams.currentAge}, Target Retirement: ${retirementParams.retirementAge}
- Current Retirement Assets: $${retirementParams.currentRetirementAssets.toLocaleString()}
- Annual Pre-Retirement Savings: $${retirementParams.annualSavings.toLocaleString()}
- Annual Guaranteed Income: $${retirementParams.annualGuaranteedIncome.toLocaleString()}
- Target Annual Expenses: $${retirementParams.annualRetirementExpenses.toLocaleString()}
- Asset Allocation: ${retirementParams.stockAllocation}% stocks, ${retirementParams.bondAllocation}% bonds

Results:
- SUCCESS PROBABILITY: ${monteCarloData.probabilityOfSuccess}% (Target: ≥80%)
- SAFE WITHDRAWAL RATE: ${(monteCarloData.safeWithdrawalRate * 100).toFixed(1)}% (Standard: 4%)
- MEDIAN ENDING BALANCE: $${monteCarloData.medianEndingBalance.toLocaleString()}
- WORST CASE (10th percentile): $${monteCarloData.percentile10EndingBalance.toLocaleString()}
- BEST CASE (90th percentile): $${monteCarloData.percentile90EndingBalance.toLocaleString()}
- Years Until Potential Depletion: ${monteCarloData.yearsUntilDepletion || 'None projected'}
- Successful Scenarios: ${monteCarloData.scenarios.successful}/${monteCarloData.scenarios.total}
` : ''}

${cashFlowData && cashFlowData.length > 0 ? `
Cash Flow Projections (Next 5 Years):
${cashFlowData.slice(0, 5).map(year => 
  `- ${year.year}: Income $${year.inflows.grossIncome.toLocaleString()}, Fixed Expenses $${year.outflows.fixed.toLocaleString()}, Tax Rate ${year.effectiveTaxRate.toFixed(1)}%`).join('\n')}
` : ''}

Target Asset Allocation:
- US Stocks: ${calculations.targetAllocation?.usStocks || 0}%
- International Stocks: ${calculations.targetAllocation?.intlStocks || 0}%
- Bonds: ${calculations.targetAllocation?.bonds || 0}%
- Alternatives: ${calculations.targetAllocation?.alternatives || 0}%
- Cash: ${calculations.targetAllocation?.cash || 0}%

Recent Recommendations:
${calculations.recommendations?.slice(0, 5).map(r => `- ${r.title}: ${r.description} (Impact: +${r.potentialImprovement || 0} points)`).join('\n') || '- No specific recommendations generated yet'}
`;

      // Add estate planning document insights if available
      if (estateDocsWithInsights.length > 0) {
        contextPrompt += `\nEstate Planning Documents:`;
        
        estateDocsWithInsights.forEach(doc => {
          const insights = doc.parsedInsights as any;
          contextPrompt += `\n\n${doc.documentType.toUpperCase()}:`;
          
          if (insights.summary) {
            contextPrompt += `\n- Summary: ${insights.summary}`;
          }
          
          if (insights.beneficiaries && insights.beneficiaries.length > 0) {
            contextPrompt += `\n- Beneficiaries: ${insights.beneficiaries.map((b: any) => `${b.name} (${b.relationship})`).join(', ')}`;
          }
          
          if (insights.executor) {
            contextPrompt += `\n- Executor: ${insights.executor.name}`;
          }
          
          if (insights.taxStrategies && insights.taxStrategies.length > 0) {
            contextPrompt += `\n- Tax Strategies: ${insights.taxStrategies.join(', ')}`;
          }
          
          if (insights.recommendations && insights.recommendations.length > 0) {
            contextPrompt += `\n- Document Recommendations: ${insights.recommendations.join('; ')}`;
          }
        });
        
        contextPrompt += `\n`;
      }
    }
    
    // Add estate plan information if available
    const estatePlan = await storage.getEstatePlan(userId);
    if (estatePlan) {
      const analysis = await calculateEstateAnalysis(estatePlan, userId);
      contextPrompt += `\nEstate Plan Analysis:
- Total Estate Value: $${parseFloat(estatePlan.totalEstateValue || '0').toLocaleString()}
- Estate Tax Liability: $${analysis.totalEstateTax.toLocaleString()}
- Net to Heirs: $${analysis.netToHeirs.toLocaleString()}
`;
    }

    contextPrompt += `User question: "${message}"

Instructions:
1. Address the user by their first name (${profile?.firstName || 'there'})
2. Provide specific, actionable advice based on their complete financial profile including all dashboard widgets and calculations
3. Reference their actual numbers from intake form, Monte Carlo analysis, cash flow projections, and all widget data when making recommendations
4. Consider their specific monthly expenses, asset portfolio, debt situation, insurance coverage, and projections when giving advice
5. If discussing retirement, ALWAYS reference their Monte Carlo analysis - success probability, safe withdrawal rate, projected balances, and specific improvement strategies
6. CRITICAL: When discussing retirement readiness, your assessment MUST align with the Monte Carlo success probability shown in the Retirement Confidence Score widget. If the Monte Carlo shows ${monteCarloData?.probabilityOfSuccess}% success, acknowledge this as their likelihood of meeting their stated retirement goals. Do NOT contradict this with different percentages or assessments.
7. If the Monte Carlo success rate is high (>80%), focus recommendations on optimization strategies rather than suggesting a crisis. If it's low (<65%), provide actionable steps to improve it.
8. Distinguish between "retirement success" (not running out of money based on stated goals) and "lifestyle maintenance" (maintaining current income levels). Be clear which metric you're discussing.
9. If discussing cash flow or budgeting, reference their specific monthly expense breakdown and cash flow projections
10. If discussing investments, reference their risk profile and target asset allocation
11. Keep responses comprehensive but focused (2-4 paragraphs)
12. If asked about general topics, relate them back to their specific situation using actual data from their profile
13. Be encouraging but realistic about their financial position based on all available metrics
14. Suggest specific, prioritized next steps they can take immediately
15. When appropriate, reference specific dashboard scores (Financial Health, Emergency Readiness, Retirement Readiness, Insurance Adequacy) to provide context

Please provide a detailed, personalized response that demonstrates deep understanding of their complete financial situation and maintains consistency with all dashboard metrics.`;

    const result = await model.generateContent(contextPrompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API error:", error);

    // Fallback responses
    const fallbackResponses = [
      "I'm having trouble accessing the AI service right now. Based on general financial principles, I recommend reviewing your budget and ensuring you have an emergency fund covering 3-6 months of expenses.",
      "The AI service is temporarily unavailable. However, I can suggest focusing on debt reduction and increasing your savings rate as key steps for financial health.",
      "I'm experiencing technical difficulties. In the meantime, consider diversifying your investments and regularly reviewing your financial goals.",
      "The AI service is down. Generally, maintaining a balanced portfolio and consistent saving habits are fundamental to financial success.",
    ];

    return fallbackResponses[
      Math.floor(Math.random() * fallbackResponses.length)
    ];
  }
}

// Analyze tax return using Gemini API with multimodal capabilities
async function analyzeTaxReturnWithGemini(
  pdfBuffer: Buffer,
  userInputs: {
    incomeChange: string;
    incomeChangeDetails: string;
    deductionChange: string;
    deductionChangeDetails: string;
  },
  userId: number
): Promise<any> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    // Get user's financial profile for additional context
    const profile = await storage.getFinancialProfile(userId);
    
    // Convert PDF buffer to base64 for Gemini
    const pdfBase64 = pdfBuffer.toString('base64');

    const prompt = `You are a certified tax professional analyzing a tax return to provide personalized tax reduction strategies.

CRITICAL INSTRUCTION: DO NOT extract or return any personal identifying information from the PDF (names, SSNs, addresses, etc.). Only extract numerical data and tax categories.

IMPORTANT: Use the latest IRS 2025 tax guidelines:
- Tax brackets: 10%, 12%, 22%, 24%, 32%, 35%, 37%
- Standard deductions: Single $15,000, MFJ $30,000, HOH $22,500
- Child tax credit: $2,000 per child (refundable portion $1,700)
- EITC max: $8,046 for 3+ children
- 401(k) contribution limit: $23,500 ($31,000 if 50+)
- IRA contribution limit: $7,000 ($8,000 if 50+)
- HSA limits: Single $4,300, Family $8,550
- SALT deduction cap: $10,000
- Capital gains rates: 0% (up to $48,350 single/$96,700 MFJ), 15%, 20%

Analyze the provided tax return (PDF) and consider:
1. User's expected income change: ${userInputs.incomeChange}
   ${userInputs.incomeChangeDetails ? `Details: ${userInputs.incomeChangeDetails}` : ''}
2. User's expected deduction change: ${userInputs.deductionChange}
   ${userInputs.deductionChangeDetails ? `Details: ${userInputs.deductionChangeDetails}` : ''}

Current user's profile (USE THIS DATA, NOT PDF NAMES):
- Annual income: $${profile?.annualIncome || 0}
- Marital status: ${profile?.maritalStatus || 'Not specified'}
- Dependents: ${profile?.dependents || 0}
- Employment: ${profile?.employmentStatus || 'Not specified'}

CRITICAL ACCURACY REQUIREMENTS:
1. Extract these numerical figures from the tax return:
   - Line 11: Adjusted Gross Income (AGI)
   - Line 12: Standard or Itemized Deductions amount
   - Line 15: Taxable Income
   - Line 24: Total Tax
   - Line 25: Federal Income Tax Withheld
   - Filing Status (Single/MFJ/HOH)
   - Number of dependents
   - W-2 wages (Box 1)
   - Self-employment income if any
   - Investment income (dividends, capital gains)
2. DO NOT extract or mention any names, SSNs, or addresses from the PDF
3. Calculate effective tax rate as: (Total Tax / AGI) × 100
4. Determine marginal tax rate based on taxable income and filing status
5. Calculate savings using PRECISE tax bracket analysis
6. Consider phase-outs for deductions and credits based on AGI
7. Account for AMT implications if applicable
8. Consider state tax implications if state return is included

CALCULATION METHODOLOGY:
- For deductions: Savings = Deduction Amount × Marginal Tax Rate
- For credits: Savings = Full Credit Amount (dollar-for-dollar reduction)
- For timing strategies: Calculate multi-year NPV using 3% discount rate
- For investment strategies: Include both ordinary income and capital gains impact

Based on advanced tax planning strategies:

1. Analyze the tax return line-by-line
2. Identify the top 5 most impactful tax reduction strategies
3. Calculate EXACT dollar savings for each strategy with detailed math
4. Rank strategies by verified potential impact (highest savings first)
5. Provide specific, actionable implementation steps

Return a JSON object with this exact structure (NO NAMES FROM PDF):
{
  "strategies": [
    {
      "title": "Strategy name",
      "description": "Clear explanation of the strategy and why it applies",
      "estimatedSavings": number (dollar amount),
      "implementation": ["Step 1", "Step 2", "Step 3"],
      "priority": 1
    }
  ],
  "currentTaxLiability": number (from Line 24 of tax return),
  "projectedTaxLiability": number (after implementing strategies),
  "totalPotentialSavings": number,
  "effectiveTaxRate": number (percentage),
  "marginalTaxRate": number (percentage),
  "adjustedGrossIncome": number (from Line 11),
  "totalDeductions": number (from Line 12),
  "taxableIncome": number (from Line 15),
  "filingStatus": "Single" | "MFJ" | "HOH" | "MFS",
  "dependentCount": number,
  "federalTaxesPaid": number (from Line 24),
  "stateTaxesPaid": number (if available),
  "w2Income": number,
  "selfEmploymentIncome": number,
  "investmentIncome": number
}

Consider strategies such as:
- Retirement account contributions (401k, IRA, backdoor Roth)
- Health Savings Account (HSA) maximization
- Tax-loss harvesting
- Charitable giving optimization (bunching, DAF)
- Business deductions and entity structure
- Education savings (529 plans)
- Timing of income and deductions
- Qualified Business Income (QBI) deduction
- Energy efficiency credits
- State tax planning strategies

IMPORTANT: Take extra time to ensure accuracy. Each strategy must include:
1. Specific line items from the tax return that support the recommendation
2. Detailed calculation showing exactly how the savings amount was determined
3. Any limitations or phase-outs that apply
4. Timeline for implementation
5. Potential risks or considerations

Double-check all calculations before returning results.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Failed to parse AI response");
    }
  } catch (error) {
    console.error("Error in tax analysis:", error);
    // Return a default structure in case of error
    return {
      strategies: [
        {
          title: "Maximize Retirement Contributions",
          description: "Increase 401(k) contributions to reduce taxable income",
          estimatedSavings: 5000,
          implementation: ["Review current contribution rate", "Calculate maximum contribution room", "Adjust payroll deductions"],
          priority: 1
        },
        {
          title: "Health Savings Account (HSA)",
          description: "Triple tax advantage: deductible contributions, tax-free growth, tax-free withdrawals for medical expenses",
          estimatedSavings: 1500,
          implementation: ["Verify HSA eligibility", "Set up automatic contributions", "Save medical receipts for future reimbursement"],
          priority: 2
        }
      ],
      currentTaxLiability: 15000,
      projectedTaxLiability: 8500,
      totalPotentialSavings: 6500,
      effectiveTaxRate: 18,
      marginalTaxRate: 24
    };
  }
}

// Generate comprehensive financial analysis without tax return using Gemini API
async function generateComprehensiveFinancialAnalysis(
  userInputs: {
    incomeChange: string;
    incomeChangeDetails: string;
    deductionChange: string;
    deductionChangeDetails: string;
  },
  userId: number
): Promise<any> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    // Get comprehensive user financial data
    const profile = await storage.getFinancialProfile(userId);
    
    // Get estate planning data if available
    const estatePlan = await storage.getEstatePlan(userId);
    
    // Get education goals data if available
    const educationGoals = await storage.getEducationGoals(userId);
    
    // Get goals data if available
    const goals = await storage.getGoals(userId);

    if (!profile) {
      throw new Error("No financial profile found for user");
    }

    // Calculate current tax overview
    const taxOverview = calculateTaxOverview(profile);

    const prompt = `You are a certified financial planner and tax professional providing hyperpersonalized tax reduction strategies.

ANALYSIS TASK: Analyze the comprehensive financial data below to provide specific, actionable tax reduction strategies ranked by urgency and potential savings.

USER FINANCIAL PROFILE:
${profile.firstName && profile.lastName ? `Name: ${profile.firstName} ${profile.lastName}` : ''}
${profile.spouseName ? `Spouse: ${profile.spouseName}` : ''}
- Marital Status: ${profile.maritalStatus || 'Not specified'}
- Dependents: ${profile.dependents || 0}
- State: ${profile.state || 'Not specified'}
- Annual Income: $${profile.annualIncome || 0}
${profile.spouseAnnualIncome ? `- Spouse Annual Income: $${profile.spouseAnnualIncome}` : ''}
- Employment Status: ${profile.employmentStatus || 'Not specified'}
${profile.spouseEmploymentStatus ? `- Spouse Employment: ${profile.spouseEmploymentStatus}` : ''}
- Other Income: $${profile.otherIncome || 0}

CURRENT TAX SITUATION:
- Gross Household Income: $${taxOverview.grossHouseholdIncome}
- Taxable Income: $${taxOverview.taxableIncome}
- Effective Tax Rate: ${taxOverview.effectiveTaxRate}%
- Projected Federal Tax: $${taxOverview.projectedFederalTax}
- Projected State Tax: $${taxOverview.projectedStateTax}
- Total Projected Tax: $${taxOverview.projectedTotalTax}

ASSETS & INVESTMENTS:
${profile.assets ? JSON.stringify(profile.assets, null, 2) : 'No asset data available'}

MONTHLY EXPENSES:
${profile.monthlyExpenses ? JSON.stringify(profile.monthlyExpenses, null, 2) : 'No expense data available'}

RETIREMENT PLANNING:
${profile.desiredRetirementAge ? `- Desired Retirement Age: ${profile.desiredRetirementAge}` : ''}
${profile.spouseDesiredRetirementAge ? `- Spouse Retirement Age: ${profile.spouseDesiredRetirementAge}` : ''}
${profile.socialSecurityClaimAge ? `- Social Security Claim Age: ${profile.socialSecurityClaimAge}` : ''}
${profile.expectedMonthlyExpensesRetirement ? `- Expected Monthly Retirement Expenses: $${profile.expectedMonthlyExpensesRetirement}` : ''}

ESTATE PLANNING:
${profile.hasWill ? '- Has Will: Yes' : '- Has Will: No'}
${profile.hasTrust ? '- Has Trust: Yes' : '- Has Trust: No'}
${profile.hasPowerOfAttorney ? '- Has Power of Attorney: Yes' : '- Has Power of Attorney: No'}
${profile.hasHealthcareProxy ? '- Has Healthcare Proxy: Yes' : '- Has Healthcare Proxy: No'}
${profile.hasBeneficiaries ? '- Has Beneficiaries: Yes' : '- Has Beneficiaries: No'}

EDUCATION PLANNING:
${educationGoals && educationGoals.length > 0 ? 
  educationGoals.map(goal => `- Child: ${goal.childName}, College Start: ${goal.collegeStartYear}, Monthly Contribution: $${goal.monthlyContribution}`).join('\n') : 
  'No education planning goals'}

LIFE GOALS:
${goals && goals.length > 0 ? 
  goals.map(goal => `- Goal: ${goal.title}, Target Amount: $${goal.targetAmountToday}, Target Date: ${goal.targetDate}`).join('\n') : 
  'No specific life goals defined'}

USER EXPECTATIONS FOR THIS YEAR:
1. Income Change: ${userInputs.incomeChange}
   ${userInputs.incomeChangeDetails ? `Details: ${userInputs.incomeChangeDetails}` : ''}
2. Deduction Change: ${userInputs.deductionChange}
   ${userInputs.deductionChangeDetails ? `Details: ${userInputs.deductionChangeDetails}` : ''}

INSTRUCTIONS:
1. Analyze ALL available financial data comprehensively
2. Generate 3-5 hyperpersonalized tax reduction strategies
3. Use names from user profile (${profile.firstName || 'you'}${profile.spouseName ? ` and ${profile.spouseName}` : ''}) in recommendations
4. Calculate SPECIFIC dollar savings for each strategy
5. Rank by urgency (1-10 scale, 10 being most urgent)
6. Consider tax deadlines and timing opportunities
7. Take at least 10 seconds to thoroughly analyze before responding

Return JSON with this exact structure:
{
  "strategies": [
    {
      "title": "Strategy name with specific details",
      "description": "Detailed explanation why this applies to user's situation",
      "estimatedSavings": number,
      "implementation": ["Specific step 1", "Specific step 2", "Specific step 3"],
      "priority": number,
      "urgency": number (1-10),
      "deadline": "Specific deadline if applicable"
    }
  ],
  "currentTaxLiability": ${taxOverview.projectedTotalTax},
  "projectedTaxLiability": number,
  "totalPotentialSavings": number,
  "effectiveTaxRate": ${taxOverview.effectiveTaxRate},
  "marginalTaxRate": ${taxOverview.marginalTaxRate}
}`;

    const result = await model.generateContent([{ text: prompt }]);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Failed to parse AI response");
    }
  } catch (error) {
    console.error("Error in comprehensive financial analysis:", error);
    // Return a default structure in case of error
    return {
      strategies: [
        {
          title: "Maximize Retirement Contributions",
          description: "Increase retirement account contributions to reduce current taxable income",
          estimatedSavings: 5000,
          implementation: ["Review current 401(k) contribution rate", "Calculate maximum contribution room", "Adjust payroll deductions"],
          priority: 1,
          urgency: 8,
          deadline: "December 31, 2024"
        },
        {
          title: "Health Savings Account Optimization", 
          description: "Maximize HSA contributions for triple tax benefits",
          estimatedSavings: 1500,
          implementation: ["Verify HSA eligibility", "Set up automatic contributions", "Save receipts for future reimbursement"],
          priority: 2,
          urgency: 7,
          deadline: "December 31, 2024"
        }
      ],
      currentTaxLiability: 15000,
      projectedTaxLiability: 8500,
      totalPotentialSavings: 6500,
      effectiveTaxRate: 18,
      marginalTaxRate: 24
    };
  }
}

// Generate cash flow data for the interactive map
function generateCashFlowData(profile: any, options: { scenarioId: string; percentile: number }) {
  const currentYear = new Date().getFullYear();
  const currentAge = profile.age || (profile.dateOfBirth ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : 30);
  const retirementAge = profile.retirementAge || 65;
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const projectionYears = 30; // Project 30 years
  
  const cashFlowData = [];
  
  for (let i = 0; i < projectionYears; i++) {
    const year = currentYear + i;
    const age = currentAge + i;
    const isRetired = age >= retirementAge;
    
    // Calculate inflows based on scenario
    let grossIncome = 0;
    let portfolioWithdrawals = 0;
    let socialSecurity = 0;
    
    if (!isRetired) {
      // Working years
      grossIncome = (profile.annualIncome || 0) * Math.pow(1.03, i); // 3% annual raises
      if (profile.maritalStatus === 'married' && profile.spouseAnnualIncome) {
        grossIncome += profile.spouseAnnualIncome * Math.pow(1.03, i);
      }
    } else {
      // Retirement years
      const retirementBalance = profile.currentRetirementBalance || 0;
      const growthRate = options.scenarioId === 'bear5yr' && i < 5 ? 0.95 : 1.07; // 5% loss or 7% growth
      const projectedBalance = retirementBalance * Math.pow(growthRate, yearsToRetirement + (i - yearsToRetirement));
      
      // 4% withdrawal rule, adjusted for scenario
      const withdrawalRate = options.scenarioId === 'conservative' ? 0.035 : 0.04;
      portfolioWithdrawals = projectedBalance * withdrawalRate;
      
      // Social Security
      const ssAge = options.scenarioId === 'delaySS' ? 70 : profile.socialSecurityAge || 67;
      if (age >= ssAge) {
        socialSecurity = 35000 * Math.pow(1.02, i); // 2% COLA
        if (profile.maritalStatus === 'married') {
          socialSecurity *= 1.5; // Spousal benefit approximation
        }
      }
    }
    
    // Calculate outflows using actual user expense data
    const inflationRate = profile.inflationRate || 2.5;
    const inflationMultiplier = Math.pow(1 + inflationRate / 100, i);
    
    // Calculate fixed expenses from actual intake form data
    let monthlyFixedExpenses = 0;
    let monthlyDiscretionaryExpenses = 0;
    
    if (profile.monthlyExpenses && typeof profile.monthlyExpenses === 'object') {
      // Fixed expenses (necessities)
      monthlyFixedExpenses = (
        (profile.monthlyExpenses.housing || 0) +
        (profile.monthlyExpenses.utilities || 0) +
        (profile.monthlyExpenses.food || 0) * 0.7 + // 70% of food is fixed (groceries)
        (profile.monthlyExpenses.transportation || 0) +
        (profile.monthlyExpenses.healthcare || 0) +
        (profile.monthlyExpenses.creditCardPayments || 0) +
        (profile.monthlyExpenses.studentLoanPayments || 0) +
        (profile.monthlyExpenses.otherDebtPayments || 0)
      );
      
      // Discretionary expenses
      monthlyDiscretionaryExpenses = (
        (profile.monthlyExpenses.entertainment || 0) +
        (profile.monthlyExpenses.clothing || 0) +
        (profile.monthlyExpenses.other || 0) +
        (profile.monthlyExpenses.food || 0) * 0.3 // 30% of food is discretionary (dining out)
      );
    } else {
      // Fallback to old calculation if monthlyExpenses is not structured
      const totalMonthly = profile.monthlyExpenses || 5000;
      monthlyFixedExpenses = totalMonthly * 0.7;
      monthlyDiscretionaryExpenses = totalMonthly * 0.3;
    }
    
    const fixed = monthlyFixedExpenses * 12 * inflationMultiplier;
    const discretionary = monthlyDiscretionaryExpenses * 12 * inflationMultiplier;
    
    // Insurance costs - use actual healthcare premiums if available
    let insurance = 0;
    if (profile.healthInsurance && profile.healthInsurance.monthlyPremium) {
      insurance = profile.healthInsurance.monthlyPremium * 12 * inflationMultiplier;
      if (isRetired) {
        // Add estimated Medicare supplement and long-term care costs in retirement
        insurance += 500 * 12 * inflationMultiplier; // Additional retirement healthcare costs
      }
    } else {
      insurance = isRetired ? 15000 * inflationMultiplier : 5000 * inflationMultiplier;
    }
    
    const goalOutflows = i < 10 ? 10000 * inflationMultiplier : 0; // Example goal costs
    
    // Tax calculations
    const taxableIncome = grossIncome + portfolioWithdrawals * 0.85 + socialSecurity * 0.85;
    const effectiveTaxRate = calculateEffectiveTaxRate(taxableIncome, profile.state || 'CA');
    const taxesTotal = taxableIncome * effectiveTaxRate / 100;
    
    // Optimization flags
    const flags: any = {};
    const ssAge = options.scenarioId === 'delaySS' ? 70 : profile.socialSecurityAge || 67;
    if (isRetired && age < ssAge && effectiveTaxRate < 12) {
      flags.rothConversionSuggested = true;
    }
    if (age >= 70.5 && taxableIncome > 100000) {
      flags.qcdSuggested = true;
    }
    if (!isRetired && taxableIncome > 200000) {
      flags.dafBunchingSuggested = true;
    }
    
    // Tax brackets (simplified federal brackets)
    const bracketThresholds: Record<string, number> = {
      '10%': 22000 * inflationMultiplier,
      '12%': 89450 * inflationMultiplier,
      '22%': 190750 * inflationMultiplier,
      '24%': 364200 * inflationMultiplier,
      '32%': 462500 * inflationMultiplier,
      '35%': 693750 * inflationMultiplier,
      '37%': 1000000 * inflationMultiplier
    };
    
    cashFlowData.push({
      year,
      inflows: {
        grossIncome: Math.round(grossIncome),
        portfolioWithdrawals: Math.round(portfolioWithdrawals),
        socialSecurity: Math.round(socialSecurity)
      },
      outflows: {
        fixed: Math.round(fixed),
        discretionary: Math.round(discretionary),
        insurance: Math.round(insurance),
        goalOutflows: Math.round(goalOutflows),
        taxesTotal: Math.round(taxesTotal)
      },
      effectiveTaxRate: Math.round(effectiveTaxRate * 10) / 10,
      bracketThresholds,
      taxableIncome: Math.round(taxableIncome),
      marginalRate: calculateMarginalRate(taxableIncome),
      flags
    });
  }
  
  return cashFlowData;
}

// Helper function to calculate effective tax rate
function calculateEffectiveTaxRate(taxableIncome: number, state: string): number {
  // Simplified federal tax calculation
  let federalTax = 0;
  
  if (taxableIncome <= 22000) {
    federalTax = taxableIncome * 0.10;
  } else if (taxableIncome <= 89450) {
    federalTax = 2200 + (taxableIncome - 22000) * 0.12;
  } else if (taxableIncome <= 190750) {
    federalTax = 10294 + (taxableIncome - 89450) * 0.22;
  } else if (taxableIncome <= 364200) {
    federalTax = 32580 + (taxableIncome - 190750) * 0.24;
  } else if (taxableIncome <= 462500) {
    federalTax = 74208 + (taxableIncome - 364200) * 0.32;
  } else if (taxableIncome <= 693750) {
    federalTax = 105664 + (taxableIncome - 462500) * 0.35;
  } else {
    federalTax = 186601.50 + (taxableIncome - 693750) * 0.37;
  }
  
  // Add simplified state tax
  const stateTaxRate = state === 'CA' ? 0.093 : state === 'NY' ? 0.0685 : state === 'TX' ? 0 : 0.05;
  const stateTax = taxableIncome * stateTaxRate;
  
  const totalTax = federalTax + stateTax;
  return taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;
}

// Helper function to calculate marginal tax rate
function calculateMarginalRate(taxableIncome: number): number {
  if (taxableIncome <= 22000) return 10;
  if (taxableIncome <= 89450) return 12;
  if (taxableIncome <= 190750) return 22;
  if (taxableIncome <= 364200) return 24;
  if (taxableIncome <= 462500) return 32;
  if (taxableIncome <= 693750) return 35;
  return 37;
}

// Generate comprehensive AI-powered insights for dashboard using all available data
async function generateComprehensiveInsights(profileData: any, metrics: any): Promise<any[]> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini AI key not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    const age = profileData.dateOfBirth ? 
      new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear() : 30;

    // Get comprehensive dashboard widget data for insights
    let monteCarloData = null;
    let retirementParams = null;
    let cashFlowData = null;
    
    // DISABLED: Monte Carlo simulation on dashboard load for performance
    // This was causing 15-20 second delays when loading the dashboard
    /*
    try {
      retirementParams = profileToRetirementParams(profileData);
      monteCarloData = await runRightCapitalStyleMonteCarloSimulation(retirementParams, 1000);
      cashFlowData = generateCashFlowData(profileData, { scenarioId: 'base', percentile: 50 });
      
      console.log('Monte Carlo data for AI insights:', {
        probabilityOfSuccess: monteCarloData?.probabilityOfSuccess,
        safeWithdrawalRate: monteCarloData?.safeWithdrawalRate,
        medianEndingBalance: monteCarloData?.medianEndingBalance,
        yearsUntilDepletion: monteCarloData?.yearsUntilDepletion
      });
    } catch (error) {
      console.log('Error fetching widget data for comprehensive insights:', error);
    }
    */
    
    // Only generate cash flow data (much faster)
    try {
      cashFlowData = generateCashFlowData(profileData, { scenarioId: 'base', percentile: 50 });
    } catch (error) {
      console.log('Error fetching cash flow data for insights:', error);
    }

    // Analyze retirement contribution opportunities for prompt
    const contributionOpportunities = analyzeRetirementContributionOpportunities(profileData, metrics);
    const hasLTC = profileData.hasLongTermCareInsurance;
    const spouseHasLTC = profileData.spouseHasLongTermCareInsurance;
    const hasSpouse = profileData.maritalStatus === 'married';
    
    const prompt = `You are an expert CFP providing personalized financial insights based on comprehensive dashboard analysis.

User Profile:
- Name: ${profileData.firstName || 'User'}
- Age: ${age}
- Marital Status: ${profileData.maritalStatus || 'Single'}
- Dependents: ${profileData.dependents || 0}
- Employment: ${profileData.employmentStatus || 'Not specified'}
- Has LTC Insurance: ${hasLTC ? 'Yes' : 'No'}
- Spouse Has LTC: ${hasSpouse ? (spouseHasLTC ? 'Yes' : 'No (CRITICAL GAP)') : 'N/A'}

Complete Financial Dashboard Data:
- Financial Health Score: ${metrics.healthScore}/100
- Net Worth: $${metrics.totalAssets - metrics.totalLiabilities}
- Monthly Cash Flow: $${metrics.monthlyCashFlow}
- Emergency Readiness Score: ${metrics.emergencyScore}/100 (${metrics.emergencyMonths?.toFixed(1)} months covered)
- Retirement Readiness Score: ${metrics.retirementScore}/100
- Insurance Adequacy Score: ${metrics.insuranceScore}/100
- Debt-to-Income Ratio: ${metrics.dtiRatio?.toFixed(1)}%
- Savings Rate: ${metrics.savingsRate?.toFixed(1)}%
- Risk Profile: ${metrics.riskProfile}

${monteCarloData && retirementParams ? `
CRITICAL: Monte Carlo Retirement Analysis (1,000 Scenarios Simulated):
Input Parameters Used:
- Current Age: ${retirementParams.currentAge}, Retirement Age: ${retirementParams.retirementAge}
- Life Expectancy: ${retirementParams.lifeExpectancy} years
- Current Retirement Assets: $${retirementParams.currentRetirementAssets.toLocaleString()}
- Annual Guaranteed Income (SS, Pensions): $${retirementParams.annualGuaranteedIncome.toLocaleString()}
- Annual Retirement Expenses: $${retirementParams.annualRetirementExpenses.toLocaleString()}
- Annual Pre-Retirement Savings: $${retirementParams.annualSavings.toLocaleString()}
- Stock/Bond/Cash Allocation: ${retirementParams.stockAllocation}%/${retirementParams.bondAllocation}%/${retirementParams.cashAllocation}%
- Target Withdrawal Rate: ${(retirementParams.withdrawalRate * 100).toFixed(1)}%
- Legacy Goal: $${retirementParams.legacyGoal.toLocaleString()}

Monte Carlo Results (Critical for Insights):
- SUCCESS PROBABILITY: ${monteCarloData.probabilityOfSuccess}% (Target: ≥80%)
- SAFE WITHDRAWAL RATE: ${(monteCarloData.safeWithdrawalRate * 100).toFixed(1)}% (vs standard 4%)
- MEDIAN ENDING BALANCE: $${monteCarloData.medianEndingBalance.toLocaleString()}
- WORST CASE (10th percentile): $${monteCarloData.percentile10EndingBalance.toLocaleString()}
- BEST CASE (90th percentile): $${monteCarloData.percentile90EndingBalance.toLocaleString()}
- Years Until Potential Depletion: ${monteCarloData.yearsUntilDepletion || 'None projected'}
- Successful Scenarios: ${monteCarloData.scenarios.successful}/${monteCarloData.scenarios.total}
- Confidence Intervals: 10th: ${monteCarloData.confidenceIntervals.percentile10}%, 50th: ${monteCarloData.confidenceIntervals.percentile50}%, 90th: ${monteCarloData.confidenceIntervals.percentile90}%

METHODOLOGY: This analysis runs 1,000 different market scenarios using historical volatility patterns. Each scenario tests whether the portfolio can sustain the planned withdrawal rate throughout retirement while accounting for sequence of returns risk, inflation variability, and market volatility.` : 'Monte Carlo Analysis: Not available'}

${cashFlowData && cashFlowData.length > 0 ? `Cash Flow Projections:
${cashFlowData.slice(0, 3).map(year => 
  `- ${year.year}: Income $${year.inflows.grossIncome.toLocaleString()}, Expenses $${year.outflows.fixed.toLocaleString()}, Tax Rate ${year.effectiveTaxRate.toFixed(1)}%`).join('\n')}` : ''}

Monthly Expenses Breakdown:
${profileData.monthlyExpenses ? Object.entries(profileData.monthlyExpenses).map(([category, amount]) => 
  `- ${category}: $${Number(amount || 0).toLocaleString()}`).join('\n') : 'Not detailed'}

Asset Portfolio:
${profileData.assets ? profileData.assets.slice(0, 5).map(asset => 
  `- ${asset.type}: $${Number(asset.value || 0).toLocaleString()} (${asset.owner})`).join('\n') : 'No assets listed'}

Retirement Account Opportunities (PRIORITY):
${contributionOpportunities.length > 0 ? contributionOpportunities.map(opp => 
  `- ${opp.account}: Can contribute up to $${opp.maxContribution}/year (Recommended: $${opp.recommendedContribution}/year)`).join('\n') : 
  'All retirement accounts maximized or insufficient cash flow'}

Current System Recommendations:
${metrics.recommendations?.slice(0, 3).map(r => `- ${r.title}: ${r.description}`).join('\n') || 'None'}

TASK: Generate EXACTLY 3 highly personalized, actionable insights with MANDATORY PRIORITY ORDER:

MANDATORY PRIORITY ORDER FOR RECOMMENDATIONS:
1. Long-term care insurance (if missing and age >= 45)
2. Maximize retirement account contributions (if positive cash flow and opportunities exist)
3. Optimize portfolio allocation for risk profile
4. Optimize Social Security claiming strategy
5. Consider delaying retirement
6. Reduce retirement expenses

Requirements for all insights:
1. Follow the PRIORITY ORDER above when generating recommendations
2. If user lacks LTC insurance and is 45+, that MUST be the first recommendation
3. If user has positive cash flow and retirement account opportunities, that MUST be high priority
4. Synthesize ALL dashboard data (scores, Monte Carlo, cash flow, expenses, assets)
5. Provide specific, actionable next steps with dollar amounts where relevant
6. Consider their life stage, family situation, and risk profile
7. Reference actual numbers from their data
8. Each insight must be actionable and specific to their situation
9. NEVER mention specific ages for Social Security claiming (no "age 67", "age 70", etc.)
10. For Social Security, only say "Optimize Social Security claiming strategy"

Return ONLY a JSON array with this exact format:
[
  {
    "title": "Insight Title (max 60 chars)",
    "description": "Detailed description referencing specific numbers from their data (2-3 sentences, max 200 chars)",
    "category": "retirement|emergency_fund|debt|insurance|investments|tax_optimization|cash_flow",
    "priority": 1-5 (1 = highest),
    "potentialImprovement": 5-25 (estimated Financial Health Score points),
    "estimatedCost": 0-50000 (estimated cost to implement),
    "estimatedTime": "immediate|1-3_months|3-6_months|6-12_months"
  }
]

Focus on insights that would have the highest impact on their overall financial wellbeing.

EXAMPLE for retirement insight (adapt to their specific data):
{
  "title": "Boost Retirement Success Rate",
  "description": "Your Monte Carlo shows 65% success vs 80% target. Increasing savings by $500/month could improve probability to 78% and safe withdrawal rate to 3.8%.",
  "category": "retirement",
  "priority": 1,
  "potentialImprovement": 15,
  "estimatedCost": 6000,
  "estimatedTime": "immediate"
}

CRITICAL: Use their ACTUAL Monte Carlo numbers in the first insight.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const insights = JSON.parse(jsonMatch[0]);
      console.log('Generated AI insights:', insights);
      
      // Ensure at least one retirement insight exists
      const hasRetirementInsight = insights.some(insight => 
        insight.category === 'retirement' || 
        insight.title.toLowerCase().includes('retirement') ||
        insight.description.toLowerCase().includes('retirement') ||
        insight.description.toLowerCase().includes('monte carlo')
      );
      
      if (!hasRetirementInsight && monteCarloData) {
        // Add fallback retirement insight if none exists
        const retirementInsight = {
          title: "Optimize Retirement Success Rate",
          description: `Your Monte Carlo analysis shows ${monteCarloData.probabilityOfSuccess}% success probability. ${monteCarloData.probabilityOfSuccess < 80 ? 'Consider increasing savings to reach the 80% target.' : 'Excellent retirement readiness - maintain your strategy.'}`,
          category: "retirement",
          priority: 1,
          potentialImprovement: Math.max(5, Math.min(20, 80 - monteCarloData.probabilityOfSuccess)),
          estimatedCost: 0,
          estimatedTime: "immediate"
        };
        insights.unshift(retirementInsight); // Add as first insight
        console.log('Added fallback retirement insight');
      }
      
      return insights;
    } else {
      console.log('No valid JSON found in AI response');
      return [];
    }
  } catch (error) {
    console.error('Error generating comprehensive insights:', error);
    return [];
  }
}

// Calculate detailed tax overview from user's financial profile
function calculateTaxOverview(profile: FinancialProfile): any {
  const currentYear = new Date().getFullYear();
  
  // Calculate gross household income
  const annualIncome = parseFloat(profile.annualIncome?.toString() || '0');
  const spouseAnnualIncome = parseFloat(profile.spouseAnnualIncome?.toString() || '0');
  const otherIncome = parseFloat(profile.otherIncome?.toString() || '0');
  const grossHouseholdIncome = annualIncome + spouseAnnualIncome + otherIncome;

  // Get state for tax calculations
  const state = profile.state || 'CA';
  
  // Calculate deductions - this is simplified and should be based on actual intake form data
  // For now, we'll use standard deduction
  const standardDeduction = profile.maritalStatus === 'married' ? 29200 : 14600; // 2024 values
  
  // In a real implementation, we'd get itemized deductions from the intake form
  // For now, use standard deduction as baseline
  const totalDeductions = standardDeduction;
  
  // Calculate taxable income
  const taxableIncome = Math.max(0, grossHouseholdIncome - totalDeductions);
  
  // Calculate federal tax
  let federalTax = 0;
  if (taxableIncome <= 22000) {
    federalTax = taxableIncome * 0.10;
  } else if (taxableIncome <= 89450) {
    federalTax = 2200 + (taxableIncome - 22000) * 0.12;
  } else if (taxableIncome <= 190750) {
    federalTax = 10294 + (taxableIncome - 89450) * 0.22;
  } else if (taxableIncome <= 364200) {
    federalTax = 32580 + (taxableIncome - 190750) * 0.24;
  } else if (taxableIncome <= 462500) {
    federalTax = 74208 + (taxableIncome - 364200) * 0.32;
  } else if (taxableIncome <= 693750) {
    federalTax = 105664 + (taxableIncome - 462500) * 0.35;
  } else {
    federalTax = 186601.50 + (taxableIncome - 693750) * 0.37;
  }
  
  // Calculate state tax
  const stateTaxRates: { [key: string]: number } = {
    'CA': 0.093, 'NY': 0.0685, 'TX': 0, 'FL': 0, 'WA': 0, 'NV': 0, 'TN': 0, 'SD': 0, 'WY': 0
  };
  const stateTaxRate = stateTaxRates[state] || 0.05; // Default 5% for other states
  const stateTax = taxableIncome * stateTaxRate;
  
  const projectedTotalTax = federalTax + stateTax;
  const effectiveTaxRate = grossHouseholdIncome > 0 ? (projectedTotalTax / grossHouseholdIncome) * 100 : 0;
  const marginalTaxRate = calculateMarginalRate(taxableIncome);

  return {
    grossHouseholdIncome,
    totalDeductions,
    taxableIncome,
    effectiveTaxRate: Math.round(effectiveTaxRate * 10) / 10, // Round to 1 decimal
    marginalTaxRate,
    projectedFederalTax: Math.round(federalTax),
    projectedStateTax: Math.round(stateTax),
    projectedTotalTax: Math.round(projectedTotalTax),
    currentTaxYear: currentYear
  };
}

// Calculate goal probability using Monte Carlo simulation
async function calculateGoalProbability(goal: Goal, profile: FinancialProfile): Promise<number> {
  const currentYear = new Date().getFullYear();
  const targetYear = new Date(goal.targetDate).getFullYear();
  const yearsToGoal = Math.max(1, targetYear - currentYear);
  
  // Adjust target amount for inflation
  const inflationRate = parseFloat(goal.inflationAssumptionPct?.toString() || '2.5') / 100;
  const futureValue = parseFloat(goal.targetAmountToday.toString()) * Math.pow(1 + inflationRate, yearsToGoal);
  
  // Get current savings and monthly contribution capacity
  const currentSavings = parseFloat(goal.currentSavings?.toString() || '0');
  const monthlyIncome = parseFloat(profile.takeHomeIncome?.toString() || '0') / 12;
  const monthlyExpensesTotal = Object.values(profile.monthlyExpenses || {}).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);
  const monthlySavingsCapacity = Math.max(0, monthlyIncome - monthlyExpensesTotal);
  
  // Risk-adjusted return rates
  const riskReturnMap = {
    conservative: { mean: 0.04, stdDev: 0.08 },
    moderate: { mean: 0.07, stdDev: 0.12 },
    aggressive: { mean: 0.10, stdDev: 0.18 }
  };
  
  const riskProfile = riskReturnMap[goal.riskPreference as keyof typeof riskReturnMap] || riskReturnMap.moderate;
  
  // Run Monte Carlo simulation (1000 iterations)
  const simulations = 1000;
  let successCount = 0;
  
  for (let i = 0; i < simulations; i++) {
    let balance = currentSavings;
    
    for (let year = 0; year < yearsToGoal; year++) {
      // Generate random return based on normal distribution
      const randomReturn = normalRandom(riskProfile.mean, riskProfile.stdDev);
      
      // Apply return and add monthly contributions
      balance = balance * (1 + randomReturn) + monthlySavingsCapacity * 12;
    }
    
    if (balance >= futureValue) {
      successCount++;
    }
  }
  
  return Math.round((successCount / simulations) * 100);
}

// Normal distribution random number generator (Box-Muller transform)
function normalRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

// Generate hyperpersonalized tax recommendations using Gemini API
async function generateHyperpersonalizedTaxRecommendations(
  userId: number,
  profile: any
): Promise<any> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    // Get additional planning data from different centers
    const retirementData = profile.retirementPlanningData || {};
    
    // Get estate planning data
    const estatePlanning = profile.estatePlanning || {};
    
    // Get education goals data
    let userEducationGoals = [];
    try {
      const { educationGoals } = await import("../shared/schema");
      const educationResult = await db.query.educationGoals.findMany({
        where: eq(educationGoals.userId, userId)
      });
      userEducationGoals = educationResult || [];
    } catch (error) {
      console.log("No education goals found for user");
    }
    
    // Get estate plan data
    let userEstatePlan = null;
    try {
      const { estatePlans } = await import("../shared/schema");
      userEstatePlan = await db.query.estatePlans.findFirst({
        where: eq(estatePlans.userId, userId)
      });
    } catch (error) {
      console.log("No estate plan found for user");
    }

    // Build comprehensive context from all available user data
    const formatCurrency = (amount: any) => amount ? `$${Number(amount).toLocaleString()}` : 'Not provided';
    
    const userContext = `
COMPREHENSIVE USER FINANCIAL PROFILE FOR TAX OPTIMIZATION:

PERSONAL INFORMATION:
- Name: ${profile.firstName} ${profile.lastName}
- Age: ${profile.dateOfBirth ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : 'Not provided'}
- Marital Status: ${profile.maritalStatus || 'Not provided'}
- State: ${profile.state || 'Not provided'}
- Dependents: ${profile.dependents || 0}
- Spouse: ${profile.spouseName || 'Not applicable'}

INCOME INFORMATION:
- Annual Income: ${formatCurrency(profile.annualIncome)}
- Spouse Annual Income: ${formatCurrency(profile.spouseAnnualIncome)}
- Other Income: ${formatCurrency(profile.otherIncome)}
- Employment Status: ${profile.employmentStatus || 'Not provided'}
- Spouse Employment Status: ${profile.spouseEmploymentStatus || 'Not provided'}
- Tax Withholding: ${profile.taxWithholdingStatus || 'Not provided'}

TAX SITUATION:
- Last Year AGI: ${formatCurrency(profile.lastYearAGI)}
- Tax Filing Status: ${profile.taxFilingStatus || 'Not provided'}
- Deduction Amount: ${formatCurrency(profile.deductionAmount)}

ASSETS & INVESTMENTS:
- Total Assets: ${profile.assets ? profile.assets.map((a: any) => `${a.type}: ${formatCurrency(a.value)} (${a.owner})`).join(', ') : 'Not provided'}
- Primary Residence Value: ${formatCurrency(profile.primaryResidence?.marketValue)}
- Primary Residence Mortgage: ${formatCurrency(profile.primaryResidence?.mortgageBalance)}

RETIREMENT PLANNING:
- Desired Retirement Age: ${profile.desiredRetirementAge || profile.retirementAge || 'Not provided'}
- Spouse Retirement Age: ${profile.spouseDesiredRetirementAge || 'Not applicable'}
- Life Expectancy: ${profile.userLifeExpectancy || profile.lifeExpectancy || 'Not provided'}
- Expected Monthly Retirement Expenses: ${formatCurrency(profile.expectedMonthlyExpensesRetirement)}
- Social Security Claim Age: ${profile.socialSecurityClaimAge || 'Not provided'}
- Current Retirement Assets: ${profile.assets ? profile.assets.filter((a: any) => a.type?.toLowerCase().includes('401k') || a.type?.toLowerCase().includes('ira') || a.type?.toLowerCase().includes('retirement')).map((a: any) => `${a.type}: ${formatCurrency(a.value)}`).join(', ') : 'Not provided'}

RETIREMENT DATA CENTER ADDITIONAL INFO:
${retirementData.socialSecurityBenefit ? `- Expected Social Security Benefit: ${formatCurrency(retirementData.socialSecurityBenefit)}` : ''}
${retirementData.hsaBalance ? `- HSA Balance: ${formatCurrency(retirementData.hsaBalance)}` : ''}
${retirementData.traditional401k ? `- Traditional 401(k): ${formatCurrency(retirementData.traditional401k)}` : ''}
${retirementData.roth401k ? `- Roth 401(k): ${formatCurrency(retirementData.roth401k)}` : ''}
${retirementData.traditionalIRA ? `- Traditional IRA: ${formatCurrency(retirementData.traditionalIRA)}` : ''}
${retirementData.rothIRA ? `- Roth IRA: ${formatCurrency(retirementData.rothIRA)}` : ''}
${retirementData.taxableBrokerage ? `- Taxable Brokerage: ${formatCurrency(retirementData.taxableBrokerage)}` : ''}
${retirementData.currentTaxBracket ? `- Current Tax Bracket: ${retirementData.currentTaxBracket}` : ''}

DEBT & LIABILITIES:
- Liabilities: ${profile.liabilities ? profile.liabilities.map((l: any) => `${l.type}: ${formatCurrency(l.balance)} (${formatCurrency(l.monthlyPayment)}/month)`).join(', ') : 'Not provided'}

MONTHLY EXPENSES:
${profile.monthlyExpenses ? Object.entries(profile.monthlyExpenses).map(([key, value]) => `- ${key}: ${formatCurrency(value)}`).join('\n') : 'Not provided'}

INSURANCE:
- Life Insurance: ${profile.lifeInsurance?.hasPolicy ? `${formatCurrency(profile.lifeInsurance.coverageAmount)} coverage` : 'None'}
- Health Insurance: ${profile.healthInsurance?.hasHealthInsurance ? 'Yes' : 'No'}
- Disability Insurance: ${profile.disabilityInsurance?.hasPolicy ? 'Yes' : 'No'}

ESTATE PLANNING:
- Will: ${profile.hasWill ? 'Yes' : 'No'}
- Trust: ${profile.hasTrust ? 'Yes' : 'No'}
- Power of Attorney: ${profile.hasPowerOfAttorney ? 'Yes' : 'No'}
- Healthcare Proxy: ${profile.hasHealthcareProxy ? 'Yes' : 'No'}
${userEstatePlan ? `
DETAILED ESTATE PLAN:
- Total Estate Value: ${formatCurrency(userEstatePlan.totalEstateValue)}
- Liquid Assets: ${formatCurrency(userEstatePlan.liquidAssets)}
- Illiquid Assets: ${formatCurrency(userEstatePlan.illiquidAssets)}
- Federal Exemption Used: ${formatCurrency(userEstatePlan.federalExemptionUsed)}
- Estimated Federal Estate Tax: ${formatCurrency(userEstatePlan.estimatedFederalEstateTax)}
` : ''}

EDUCATION PLANNING:
${userEducationGoals.length > 0 ? userEducationGoals.map((goal: any) => `
- Student: ${goal.studentName} (${goal.relationship})
- Goal: ${goal.degreeType} starting ${goal.startYear}
- Expected Cost: ${formatCurrency(goal.costPerYear)} per year
- State: ${goal.stateOfResidence}
- 529 Plan Coverage: ${goal.coverPercent}%
`).join('') : '- No education goals currently set'}

TAX RETURN DATA:
${profile.taxReturns ? '- Tax return data available for enhanced analysis' : '- No tax return uploaded'}
`;

    const prompt = `
You are a certified tax strategist and financial planner. Based on the comprehensive financial profile above, generate HYPERPERSONALIZED tax reduction recommendations.

CRITICAL REQUIREMENTS:
1. Generate 8-12 specific, actionable tax strategies ranked by URGENCY (1 = implement immediately, 5 = long-term planning)
2. Calculate PRECISE dollar amounts for tax savings for each recommendation
3. Consider the user's specific state, income level, age, marital status, and retirement timeline
4. Factor in 2024 tax law changes and opportunities
5. Provide specific action items for each recommendation
6. Consider both current year and multi-year tax optimization

FOCUS AREAS TO ANALYZE (using ALL available data):
- Retirement account optimization (traditional vs Roth conversions) - use retirement center data
- HSA maximization strategies - use healthcare costs from retirement planning
- Tax-loss harvesting opportunities - use investment asset data
- Income timing and deferral strategies - use income and employment data
- Deduction optimization and bundling - use state and expense data
- State-specific tax advantages - use state of residence
- Asset location strategies - use detailed asset allocation data
- Estate and gift tax planning - use estate planning data and values
- Education tax credits and 529 planning - use education goals data
- Healthcare expense optimization - use insurance and health data
- Trust and estate tax strategies - use estate plan details if available
- Charitable giving strategies - use estate and income data
- Family tax planning - use spouse and dependent data

Return ONLY a valid JSON object with this exact structure:
{
  "recommendations": [
    {
      "title": "Strategy title",
      "description": "Detailed explanation of the strategy",
      "urgency": 1-5,
      "estimatedAnnualSavings": dollar_amount,
      "implementationTimeframe": "immediate/3-6 months/annual/multi-year",
      "actionItems": [
        "Specific step 1",
        "Specific step 2",
        "Specific step 3"
      ],
      "requirements": ["What's needed to implement"],
      "risks": "Potential risks or considerations",
      "deadline": "Tax deadline or timing consideration"
    }
  ],
  "totalEstimatedSavings": total_dollar_amount,
  "priority": "immediate/quarterly/annual",
  "lastUpdated": "${new Date().toISOString()}"
}

Ensure recommendations are:
- Specific to the user's exact situation
- Legally compliant and conservative
- Include precise dollar calculations based on their income and tax bracket
- Prioritized by potential impact and urgency
- Actionable with clear next steps
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsedResult = JSON.parse(jsonMatch[0]);
      console.log("Generated tax recommendations:", parsedResult);
      return parsedResult;
    } else {
      throw new Error("Could not parse AI response");
    }

  } catch (error) {
    console.error("Error generating tax recommendations:", error);
    
    // Return fallback recommendations if AI fails
    return {
      recommendations: [
        {
          title: "Maximize Retirement Contributions",
          description: "Increase your 401(k) and IRA contributions to reduce taxable income",
          urgency: 2,
          estimatedAnnualSavings: 5000,
          implementationTimeframe: "immediate",
          actionItems: [
            "Contact HR to increase 401(k) contribution percentage",
            "Set up automatic IRA contributions",
            "Consider catch-up contributions if over 50"
          ],
          requirements: ["Access to payroll system", "Available income for increased contributions"],
          risks: "Reduced current cash flow",
          deadline: "December 31, 2024"
        },
        {
          title: "Tax-Loss Harvesting",
          description: "Realize capital losses to offset gains and reduce tax liability",
          urgency: 3,
          estimatedAnnualSavings: 2000,
          implementationTimeframe: "quarterly",
          actionItems: [
            "Review investment portfolio for unrealized losses",
            "Sell losing positions before year-end",
            "Reinvest in similar but not identical securities"
          ],
          requirements: ["Taxable investment accounts with losses"],
          risks: "Wash sale rules, market timing risk",
          deadline: "December 31, 2024"
        }
      ],
      totalEstimatedSavings: 7000,
      priority: "quarterly",
      lastUpdated: new Date().toISOString()
    };
  }
}
