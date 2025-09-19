import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Plus, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  Info,
  Building,
  Shield,
  Heart,
  Users
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EstateDocument } from '@shared/schema';
import { format } from 'date-fns';

interface DocumentTrackerProps {
  estatePlanId?: number;
}

export function DocumentTracker({ estatePlanId }: DocumentTrackerProps) {
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [editingDocument, setEditingDocument] = useState<EstateDocument | null>(null);
  const [willGen, setWillGen] = useState<{ files: Array<{ kind: string; urlPath: string }> } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['estate-documents', estatePlanId],
    queryFn: async () => {
      const url = estatePlanId 
        ? `/api/estate-documents?estatePlanId=${estatePlanId}`
        : '/api/estate-documents';
      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
  });

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: any) => {
      // Only include estatePlanId if it exists
      const payload = estatePlanId 
        ? { ...data, estatePlanId }
        : data;
        
      const response = await fetch('/api/estate-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let errorMessage = 'Failed to create document';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = await response.text() || errorMessage;
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estate-documents'] });
      setShowAddDocument(false);
    },
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/estate-documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update document');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estate-documents'] });
      setEditingDocument(null);
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/estate-documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete document');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estate-documents'] });
    },
  });

  const documentTypes = [
    { value: 'will', label: 'Will', icon: FileText },
    { value: 'trust', label: 'Trust', icon: Building },
    { value: 'poa', label: 'Power of Attorney', icon: Shield },
    { value: 'healthcare_directive', label: 'Healthcare Directive', icon: Heart },
    { value: 'beneficiary_form', label: 'Beneficiary Form', icon: Users },
    { value: 'other', label: 'Other', icon: FileText },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'executed':
        return <Badge className="bg-green-600/20 text-green-400 border-green-600">Executed</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600">Draft</Badge>;
      case 'needs_update':
        return <Badge className="bg-orange-600/20 text-orange-400 border-orange-600">Needs Update</Badge>;
      case 'expired':
        return <Badge className="bg-red-600/20 text-red-400 border-red-600">Expired</Badge>;
      default:
        return null;
    }
  };

  // Fetch financial profile to check marital status
  const { data: profile } = useQuery({
    queryKey: ['/api/financial-profile'],
    queryFn: async () => {
      const response = await fetch('/api/financial-profile', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
  });
  
  const isMarried = profile?.maritalStatus === 'married';
  const spouseName = profile?.spouseName || 'Spouse';
  const userName = profile ? `${profile.firstName} ${profile.lastName}` : 'User';
  
  async function handleGenerateWill() {
    setIsGenerating(true);
    try {
      const resp = await fetch('/api/wills/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setWillGen({ files: (data.files || []).map((f: any) => ({ kind: f.kind, urlPath: f.urlPath })) });
      queryClient.invalidateQueries({ queryKey: ['estate-documents'] });
    } catch (e) {
      console.error('Failed to generate will', e);
    } finally {
      setIsGenerating(false);
    }
  }
  
  const DocumentForm = ({ document }: { document?: EstateDocument | null }) => {
    const [formData, setFormData] = useState({
      documentType: document?.documentType || 'will',
      documentName: document?.documentName || '',
      description: document?.description || '',
      status: document?.status || 'draft',
      executionDate: document?.executionDate ? format(new Date(document.executionDate), 'yyyy-MM-dd') : '',
      lastReviewDate: document?.lastReviewDate ? format(new Date(document.lastReviewDate), 'yyyy-MM-dd') : '',
      preparedBy: document?.preparedBy || '',
      storageLocation: document?.storageLocation || '',
      notarized: document?.notarized || false,
      reviewReminderDays: document?.reviewReminderDays || 365,
      forSpouse: document?.forSpouse || false, // false = user's document, true = spouse's document
    });
    

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      // Convert empty date strings to null and ensure proper data types
      const dataToSubmit = {
        documentType: formData.documentType,
        documentName: formData.documentName,
        description: formData.description || null,
        status: formData.status,
        // Send date strings as-is, backend will handle conversion
        executionDate: formData.executionDate || null,
        lastReviewDate: formData.lastReviewDate || null,
        preparedBy: formData.preparedBy || null,
        storageLocation: formData.storageLocation || null,
        notarized: formData.notarized,
        reviewReminderDays: formData.reviewReminderDays || null,
        forSpouse: isMarried ? formData.forSpouse : false,
      };
      
      if (document) {
        updateDocumentMutation.mutate({ id: document.id, data: dataToSubmit });
      } else {
        createDocumentMutation.mutate(dataToSubmit);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {(createDocumentMutation.isError || updateDocumentMutation.isError) && (
          <Alert className="bg-red-900/20 border-red-800">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300">
              {createDocumentMutation.error?.message || updateDocumentMutation.error?.message}
            </AlertDescription>
          </Alert>
        )}
        
        {isMarried && (
          <div>
            <Label htmlFor="forSpouse" className="text-white">Document For</Label>
            <Select
              value={formData.forSpouse ? 'spouse' : 'user'}
              onValueChange={(value) => setFormData({ ...formData, forSpouse: value === 'spouse' })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{userName}</SelectItem>
                <SelectItem value="spouse">{spouseName}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="documentType" className="text-white">Document Type</Label>
            <Select
              value={formData.documentType}
              onValueChange={(value) => setFormData({ ...formData, documentType: value })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status" className="text-white">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="executed">Executed</SelectItem>
                <SelectItem value="needs_update">Needs Update</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="col-span-2">
            <Label htmlFor="documentName" className="text-white">Document Name</Label>
            <Input
              id="documentName"
              value={formData.documentName}
              onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder="e.g., Last Will and Testament 2024"
              required
            />
          </div>
        </div>

        <div className="col-span-3">
          <Label htmlFor="description" className="text-white">Brief Description</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white"
            placeholder="Brief description of the document"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="executionDate" className="text-white">Execution Date</Label>
            <Input
              id="executionDate"
              type="date"
              value={formData.executionDate}
              onChange={(e) => setFormData({ ...formData, executionDate: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          <div>
            <Label htmlFor="lastReviewDate" className="text-white">Last Review Date</Label>
            <Input
              id="lastReviewDate"
              type="date"
              value={formData.lastReviewDate}
              onChange={(e) => setFormData({ ...formData, lastReviewDate: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          <div>
            <Label htmlFor="preparedBy" className="text-white">Prepared By</Label>
            <Input
              id="preparedBy"
              value={formData.preparedBy}
              onChange={(e) => setFormData({ ...formData, preparedBy: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder="Attorney or firm name"
            />
          </div>
        </div>

        <div className="col-span-3">
          <Label htmlFor="storageDetails" className="text-white">
            Document Storage & Access Information
          </Label>
          <Textarea
            id="storageDetails"
            value={formData.storageLocation}
            onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white"
            placeholder="Include details about where original documents are stored, who has copies, access instructions, or any relevant links/references"
            rows={3}
          />
          <p className="text-xs text-gray-400 mt-1">
            Note: For security reasons, we recommend storing actual documents in a secure location 
            and using this field to track their location and access information.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="notarized"
            checked={formData.notarized}
            onChange={(e) => setFormData({ ...formData, notarized: e.target.checked })}
            className="rounded border-gray-600 bg-gray-700"
          />
          <Label htmlFor="notarized" className="text-white cursor-pointer">
            Document is notarized
          </Label>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => document ? setEditingDocument(null) : setShowAddDocument(false)}
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-[#8A00C4] hover:bg-[#7000A4]"
            disabled={createDocumentMutation.isPending || updateDocumentMutation.isPending}
          >
            {document ? 'Update' : 'Add'} Document
          </Button>
        </div>
      </form>
    );
  };

  // Group documents by owner and type
  const groupDocuments = () => {
    if (!isMarried) {
      // Single person - group by type only
      return documents.reduce((acc: any, doc: EstateDocument) => {
        const type = doc.documentType;
        if (!acc[type]) acc[type] = [];
        acc[type].push(doc);
        return acc;
      }, {});
    } else {
      // Married - separate by spouse
      const userDocs = documents.filter((doc: EstateDocument) => !doc.forSpouse);
      const spouseDocs = documents.filter((doc: EstateDocument) => doc.forSpouse);
      
      return {
        user: userDocs.reduce((acc: any, doc: EstateDocument) => {
          const type = doc.documentType;
          if (!acc[type]) acc[type] = [];
          acc[type].push(doc);
          return acc;
        }, {}),
        spouse: spouseDocs.reduce((acc: any, doc: EstateDocument) => {
          const type = doc.documentType;
          if (!acc[type]) acc[type] = [];
          acc[type].push(doc);
          return acc;
        }, {})
      };
    }
  };
  
  const groupedDocuments = groupDocuments();

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Loading documents...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Estate Planning Documents</h3>
          <p className="text-gray-400 text-sm mt-1">
            Track and manage all your important estate planning documents
          </p>
        </div>
        <Dialog open={showAddDocument} onOpenChange={setShowAddDocument}>
          <DialogTrigger asChild>
            <Button className="bg-[#8A00C4] hover:bg-[#7000A4]">
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700 max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">Add New Document</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <DocumentForm />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Important Notices */}
      <div className="space-y-4">
        <Alert className="bg-yellow-900/20 border-yellow-800">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <AlertDescription className="text-gray-300">
            Keep your estate planning documents updated. Laws change, and life events may require 
            updates to your will, trust, and other documents. Review annually or after major life changes.
          </AlertDescription>
        </Alert>
        
        <Alert className="bg-blue-900/20 border-blue-800">
          <Info className="h-4 w-4 text-blue-300" />
          <AlertDescription className="text-gray-300">
            <strong>Document Storage:</strong> This tracker helps you manage document information and locations. 
            Store original documents securely (e.g., fireproof safe, bank deposit box, attorney's office) and 
            use this system to track where documents are located, who has copies, and access instructions.
          </AlertDescription>
        </Alert>

        {/* Quick Will Draft Generator (Beta) */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-white font-semibold">Create a Will Draft</div>
              <div className="text-gray-400 text-sm">Generates HTML drafts: instructions, will, personal property memo, digital assets, funeral wishes, and beneficiary messages.</div>
            </div>
            <Button onClick={handleGenerateWill} disabled={isGenerating} className="bg-indigo-600 hover:bg-indigo-500">
              {isGenerating ? 'Generating…' : 'Generate Will Draft'}
            </Button>
          </CardContent>
          {willGen && (
            <CardContent className="pt-0">
              <div className="text-white font-medium mb-2">Your documents</div>
              <ul className="list-disc list-inside text-indigo-300">
                {willGen.files.map((f) => (
                  <li key={f.kind}><a href={f.urlPath} target="_blank" rel="noreferrer" className="hover:underline">{f.kind}</a></li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Document Groups */}
      {documents.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No documents tracked yet</p>
          </CardContent>
        </Card>
      ) : !isMarried ? (
        // Single person view
        <div className="space-y-6">
          {Object.entries(groupedDocuments).map(([type, docs]: [string, any]) => {
            const typeInfo = documentTypes.find(dt => dt.value === type);
            const Icon = typeInfo?.icon || FileText;
            
            return (
              <Card key={type} className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    {typeInfo?.label || type}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {docs.map((doc: EstateDocument) => (
                      <DocumentCard 
                        key={doc.id}
                        doc={doc}
                        onEdit={setEditingDocument}
                        onDelete={(id) => deleteDocumentMutation.mutate(id)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        // Married couple view - side by side
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User's Documents */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">{userName}'s Documents</h3>
            {Object.keys(groupedDocuments.user).length === 0 ? (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="text-center py-8">
                  <p className="text-gray-400">No documents tracked</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedDocuments.user).map(([type, docs]: [string, any]) => {
                  const typeInfo = documentTypes.find(dt => dt.value === type);
                  const Icon = typeInfo?.icon || FileText;
                  
                  return (
                    <Card key={type} className="bg-gray-800/50 border-gray-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          {typeInfo?.label || type}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {docs.map((doc: EstateDocument) => (
                            <DocumentCard 
                              key={doc.id}
                              doc={doc}
                              onEdit={setEditingDocument}
                              onDelete={(id) => deleteDocumentMutation.mutate(id)}
                              compact
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Spouse's Documents */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">{spouseName}'s Documents</h3>
            {Object.keys(groupedDocuments.spouse).length === 0 ? (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="text-center py-8">
                  <p className="text-gray-400">No documents tracked</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedDocuments.spouse).map(([type, docs]: [string, any]) => {
                  const typeInfo = documentTypes.find(dt => dt.value === type);
                  const Icon = typeInfo?.icon || FileText;
                  
                  return (
                    <Card key={type} className="bg-gray-800/50 border-gray-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          {typeInfo?.label || type}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {docs.map((doc: EstateDocument) => (
                            <DocumentCard 
                              key={doc.id}
                              doc={doc}
                              onEdit={setEditingDocument}
                              onDelete={(id) => deleteDocumentMutation.mutate(id)}
                              compact
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingDocument} onOpenChange={(open) => !open && setEditingDocument(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Document</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <DocumentForm document={editingDocument} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// Helper function to get status badge
function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-600/20 text-green-300 border-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-yellow-600/20 text-yellow-300 border-yellow-600">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'needs_update':
      return (
        <Badge className="bg-red-600/20 text-red-300 border-red-600">
          <AlertCircle className="h-3 w-3 mr-1" />
          Needs Update
        </Badge>
      );
    default:
      return null;
  }
}

// Document Card Component
function DocumentCard({ 
  doc, 
  onEdit, 
  onDelete,
  compact = false 
}: { 
  doc: EstateDocument; 
  onEdit: (d: EstateDocument) => void;
  onDelete: (id: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`bg-gray-700/30 rounded-lg ${compact ? 'p-3' : 'p-4'} flex items-center justify-between`}>
      <div className="flex-1">
        <div className={`flex items-center gap-2 ${compact ? 'mb-1' : 'mb-2'}`}>
          <h4 className={`text-white ${compact ? 'text-sm' : ''} font-medium`}>{doc.documentName}</h4>
          {getStatusBadge(doc.status)}
          {doc.notarized && !compact && (
            <Badge className="bg-blue-600/20 text-sky-300 border-blue-600">
              Notarized
            </Badge>
          )}
        </div>
        {!compact && doc.description && (
          <p className="text-gray-400 text-sm mb-2">{doc.description}</p>
        )}
        <div className={`flex flex-wrap gap-3 ${compact ? 'text-xs' : 'text-xs'} text-gray-400`}>
          {doc.executionDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(doc.executionDate), 'MMM d, yyyy')}
            </span>
          )}
          {!compact && doc.preparedBy && (
            <span>By: {doc.preparedBy}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          onClick={() => onEdit(doc)}
          className="text-gray-400 hover:text-white"
        >
          <Edit className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        </Button>
        <Button
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          onClick={() => onDelete(doc.id)}
          className="text-gray-400 hover:text-red-400"
        >
          <Trash2 className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        </Button>
      </div>
    </div>
  );
}
