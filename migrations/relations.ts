import { relations } from "drizzle-orm/relations";
import { users, plaidHoldings, goals, lifeGoals, chatMessages, pdfReports, educationGoals, estatePlans, estateBeneficiaries, investmentCache, plaidItems, plaidAccounts, plaidTransactions, sectionProgress, userProgress, userAchievements, plaidSyncSchedule, advisorInvites, estateDocuments, plaidSyncStatus, financialProfiles, debtPayoffPlans, widgetCache, dashboardInsights, plaidAccountMappings, plaidLiabilities, debts, debtPayments, plaidInvestmentTransactions, plaidSecurities, plaidInvestmentHoldings, plaidIncome, plaidAssetReports, plaidRecurringTransactions, plaidWebhooks, plaidSyncRecovery, plaidAggregatedSnapshot } from "./schema";

export const plaidHoldingsRelations = relations(plaidHoldings, ({one}) => ({
	user: one(users, {
		fields: [plaidHoldings.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	plaidHoldings: many(plaidHoldings),
	goals: many(goals),
	lifeGoals: many(lifeGoals),
	chatMessages: many(chatMessages),
	pdfReports: many(pdfReports),
	educationGoals: many(educationGoals),
	estatePlans: many(estatePlans),
	estateBeneficiaries: many(estateBeneficiaries),
	investmentCaches: many(investmentCache),
	plaidItems: many(plaidItems),
	plaidAccounts: many(plaidAccounts),
	plaidTransactions: many(plaidTransactions),
	sectionProgresses: many(sectionProgress),
	userProgresses: many(userProgress),
	userAchievements: many(userAchievements),
	plaidSyncSchedules: many(plaidSyncSchedule),
	user: one(users, {
		fields: [users.advisorId],
		references: [users.id],
		relationName: "users_advisorId_users_id"
	}),
	users: many(users, {
		relationName: "users_advisorId_users_id"
	}),
	advisorInvites_advisorId: many(advisorInvites, {
		relationName: "advisorInvites_advisorId_users_id"
	}),
	advisorInvites_clientId: many(advisorInvites, {
		relationName: "advisorInvites_clientId_users_id"
	}),
	estateDocuments: many(estateDocuments),
	plaidSyncStatuses: many(plaidSyncStatus),
	financialProfiles: many(financialProfiles),
	debtPayoffPlans: many(debtPayoffPlans),
	widgetCaches: many(widgetCache),
	dashboardInsights: many(dashboardInsights),
	plaidAccountMappings: many(plaidAccountMappings),
	plaidLiabilities: many(plaidLiabilities),
	plaidIncomes: many(plaidIncome),
	plaidAssetReports: many(plaidAssetReports),
	plaidSyncRecoveries: many(plaidSyncRecovery),
	debts: many(debts),
	plaidAggregatedSnapshots: many(plaidAggregatedSnapshot),
}));

export const goalsRelations = relations(goals, ({one}) => ({
	user: one(users, {
		fields: [goals.userId],
		references: [users.id]
	}),
}));

export const lifeGoalsRelations = relations(lifeGoals, ({one}) => ({
	user: one(users, {
		fields: [lifeGoals.userId],
		references: [users.id]
	}),
}));

export const chatMessagesRelations = relations(chatMessages, ({one}) => ({
	user: one(users, {
		fields: [chatMessages.userId],
		references: [users.id]
	}),
}));

export const pdfReportsRelations = relations(pdfReports, ({one}) => ({
	user: one(users, {
		fields: [pdfReports.userId],
		references: [users.id]
	}),
}));

export const educationGoalsRelations = relations(educationGoals, ({one}) => ({
	user: one(users, {
		fields: [educationGoals.userId],
		references: [users.id]
	}),
}));

export const estatePlansRelations = relations(estatePlans, ({one}) => ({
	user: one(users, {
		fields: [estatePlans.userId],
		references: [users.id]
	}),
}));

export const estateBeneficiariesRelations = relations(estateBeneficiaries, ({one}) => ({
	user: one(users, {
		fields: [estateBeneficiaries.userId],
		references: [users.id]
	}),
}));

export const investmentCacheRelations = relations(investmentCache, ({one}) => ({
	user: one(users, {
		fields: [investmentCache.userId],
		references: [users.id]
	}),
}));

export const plaidItemsRelations = relations(plaidItems, ({one, many}) => ({
	user: one(users, {
		fields: [plaidItems.userId],
		references: [users.id]
	}),
	plaidAccounts: many(plaidAccounts),
	plaidIncomes: many(plaidIncome),
	plaidWebhooks: many(plaidWebhooks),
	plaidSyncRecoveries: many(plaidSyncRecovery),
}));

export const plaidAccountsRelations = relations(plaidAccounts, ({one, many}) => ({
	plaidItem: one(plaidItems, {
		fields: [plaidAccounts.plaidItemId],
		references: [plaidItems.id]
	}),
	user: one(users, {
		fields: [plaidAccounts.userId],
		references: [users.id]
	}),
	plaidTransactions: many(plaidTransactions),
	plaidAccountMappings: many(plaidAccountMappings),
	plaidLiabilities: many(plaidLiabilities),
	plaidInvestmentTransactions: many(plaidInvestmentTransactions),
	plaidInvestmentHoldings_accountId: many(plaidInvestmentHoldings, {
		relationName: "plaidInvestmentHoldings_accountId_plaidAccounts_id"
	}),
	plaidInvestmentHoldings_plaidAccountId: many(plaidInvestmentHoldings, {
		relationName: "plaidInvestmentHoldings_plaidAccountId_plaidAccounts_id"
	}),
	plaidRecurringTransactions: many(plaidRecurringTransactions),
}));

export const plaidTransactionsRelations = relations(plaidTransactions, ({one}) => ({
	plaidAccount: one(plaidAccounts, {
		fields: [plaidTransactions.plaidAccountId],
		references: [plaidAccounts.id]
	}),
	user: one(users, {
		fields: [plaidTransactions.userId],
		references: [users.id]
	}),
}));

export const sectionProgressRelations = relations(sectionProgress, ({one}) => ({
	user: one(users, {
		fields: [sectionProgress.userId],
		references: [users.id]
	}),
}));

export const userProgressRelations = relations(userProgress, ({one}) => ({
	user: one(users, {
		fields: [userProgress.userId],
		references: [users.id]
	}),
}));

export const userAchievementsRelations = relations(userAchievements, ({one}) => ({
	user: one(users, {
		fields: [userAchievements.userId],
		references: [users.id]
	}),
}));

export const plaidSyncScheduleRelations = relations(plaidSyncSchedule, ({one}) => ({
	user: one(users, {
		fields: [plaidSyncSchedule.userId],
		references: [users.id]
	}),
}));

export const advisorInvitesRelations = relations(advisorInvites, ({one}) => ({
	user_advisorId: one(users, {
		fields: [advisorInvites.advisorId],
		references: [users.id],
		relationName: "advisorInvites_advisorId_users_id"
	}),
	user_clientId: one(users, {
		fields: [advisorInvites.clientId],
		references: [users.id],
		relationName: "advisorInvites_clientId_users_id"
	}),
}));

export const estateDocumentsRelations = relations(estateDocuments, ({one}) => ({
	user: one(users, {
		fields: [estateDocuments.userId],
		references: [users.id]
	}),
}));

export const plaidSyncStatusRelations = relations(plaidSyncStatus, ({one}) => ({
	user: one(users, {
		fields: [plaidSyncStatus.userId],
		references: [users.id]
	}),
}));

export const financialProfilesRelations = relations(financialProfiles, ({one}) => ({
	user: one(users, {
		fields: [financialProfiles.userId],
		references: [users.id]
	}),
}));

export const debtPayoffPlansRelations = relations(debtPayoffPlans, ({one}) => ({
	user: one(users, {
		fields: [debtPayoffPlans.userId],
		references: [users.id]
	}),
}));

export const widgetCacheRelations = relations(widgetCache, ({one}) => ({
	user: one(users, {
		fields: [widgetCache.userId],
		references: [users.id]
	}),
}));

export const dashboardInsightsRelations = relations(dashboardInsights, ({one}) => ({
	user: one(users, {
		fields: [dashboardInsights.userId],
		references: [users.id]
	}),
}));

export const plaidAccountMappingsRelations = relations(plaidAccountMappings, ({one}) => ({
	plaidAccount: one(plaidAccounts, {
		fields: [plaidAccountMappings.plaidAccountId],
		references: [plaidAccounts.id]
	}),
	user: one(users, {
		fields: [plaidAccountMappings.userId],
		references: [users.id]
	}),
}));

export const plaidLiabilitiesRelations = relations(plaidLiabilities, ({one}) => ({
	plaidAccount: one(plaidAccounts, {
		fields: [plaidLiabilities.plaidAccountId],
		references: [plaidAccounts.id]
	}),
	user: one(users, {
		fields: [plaidLiabilities.userId],
		references: [users.id]
	}),
}));

export const debtPaymentsRelations = relations(debtPayments, ({one}) => ({
	debt: one(debts, {
		fields: [debtPayments.debtId],
		references: [debts.id]
	}),
}));

export const debtsRelations = relations(debts, ({one, many}) => ({
	debtPayments: many(debtPayments),
	user: one(users, {
		fields: [debts.userId],
		references: [users.id]
	}),
}));

export const plaidInvestmentTransactionsRelations = relations(plaidInvestmentTransactions, ({one}) => ({
	plaidAccount: one(plaidAccounts, {
		fields: [plaidInvestmentTransactions.accountId],
		references: [plaidAccounts.id]
	}),
	plaidSecurity: one(plaidSecurities, {
		fields: [plaidInvestmentTransactions.securityId],
		references: [plaidSecurities.securityId]
	}),
}));

export const plaidSecuritiesRelations = relations(plaidSecurities, ({many}) => ({
	plaidInvestmentTransactions: many(plaidInvestmentTransactions),
	plaidInvestmentHoldings: many(plaidInvestmentHoldings),
}));

export const plaidInvestmentHoldingsRelations = relations(plaidInvestmentHoldings, ({one}) => ({
	plaidAccount_accountId: one(plaidAccounts, {
		fields: [plaidInvestmentHoldings.accountId],
		references: [plaidAccounts.id],
		relationName: "plaidInvestmentHoldings_accountId_plaidAccounts_id"
	}),
	plaidAccount_plaidAccountId: one(plaidAccounts, {
		fields: [plaidInvestmentHoldings.plaidAccountId],
		references: [plaidAccounts.id],
		relationName: "plaidInvestmentHoldings_plaidAccountId_plaidAccounts_id"
	}),
	plaidSecurity: one(plaidSecurities, {
		fields: [plaidInvestmentHoldings.securityId],
		references: [plaidSecurities.securityId]
	}),
}));

export const plaidIncomeRelations = relations(plaidIncome, ({one}) => ({
	plaidItem: one(plaidItems, {
		fields: [plaidIncome.itemId],
		references: [plaidItems.id]
	}),
	user: one(users, {
		fields: [plaidIncome.userId],
		references: [users.id]
	}),
}));

export const plaidAssetReportsRelations = relations(plaidAssetReports, ({one}) => ({
	user: one(users, {
		fields: [plaidAssetReports.userId],
		references: [users.id]
	}),
}));

export const plaidRecurringTransactionsRelations = relations(plaidRecurringTransactions, ({one}) => ({
	plaidAccount: one(plaidAccounts, {
		fields: [plaidRecurringTransactions.accountId],
		references: [plaidAccounts.id]
	}),
}));

export const plaidWebhooksRelations = relations(plaidWebhooks, ({one}) => ({
	plaidItem: one(plaidItems, {
		fields: [plaidWebhooks.itemId],
		references: [plaidItems.id]
	}),
}));

export const plaidSyncRecoveryRelations = relations(plaidSyncRecovery, ({one}) => ({
	plaidItem: one(plaidItems, {
		fields: [plaidSyncRecovery.plaidItemId],
		references: [plaidItems.id]
	}),
	user: one(users, {
		fields: [plaidSyncRecovery.userId],
		references: [users.id]
	}),
}));

export const plaidAggregatedSnapshotRelations = relations(plaidAggregatedSnapshot, ({one}) => ({
	user: one(users, {
		fields: [plaidAggregatedSnapshot.userId],
		references: [users.id]
	}),
}));