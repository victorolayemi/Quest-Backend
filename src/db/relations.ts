import { relations } from "drizzle-orm/relations";
import { user, otpRequest, userFeeling, friendRequest, directChat, directMessage, chatPin, journalEntry, personalNote, post, community, postReaction, communityEvent, eventAttendee, groupMessage, bibleBookmark, bibleHighlight, bibleNote, bibleReadingHistory, devotionPlan, devotionDay, userPlanProgress, sermonMedia, playProgress, quiz, question, quizAttempt, dailyBread, dailyBreadAttempt, challenge, challengeParticipant, badge, earnedBadge, notification, loginHistory, gameScore, dailyVerseLike, bookComment, book, bookReaction, mediaLike, postReport, comment, commentReaction, chatClear, devotionDayLike, subscription, userMedia, communityJoinRequest, communityMember, communityMessage, communityMessageLike, communityMessageBookmark, communityMessageComment, savedBook, communityDailyVerse, communityDailyVerseLike, communityMessageReaction, communityMessageCommentLike, report, coinTransaction } from "./schema";

export const otpRequestRelations = relations(otpRequest, ({one}) => ({
	user: one(user, {
		fields: [otpRequest.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	otpRequests: many(otpRequest),
	userFeelings: many(userFeeling),
	friendRequests_receiverId: many(friendRequest, {
		relationName: "friendRequest_receiverId_user_id"
	}),
	friendRequests_senderId: many(friendRequest, {
		relationName: "friendRequest_senderId_user_id"
	}),
	directChats_user2Id: many(directChat, {
		relationName: "directChat_user2Id_user_id"
	}),
	directChats_user1Id: many(directChat, {
		relationName: "directChat_user1Id_user_id"
	}),
	directMessages: many(directMessage),
	journalEntries: many(journalEntry),
	personalNotes: many(personalNote),
	posts: many(post),
	postReactions: many(postReaction),
	eventAttendees: many(eventAttendee),
	groupMessages: many(groupMessage),
	bibleBookmarks: many(bibleBookmark),
	bibleHighlights: many(bibleHighlight),
	bibleNotes: many(bibleNote),
	bibleReadingHistories: many(bibleReadingHistory),
	userPlanProgresses: many(userPlanProgress),
	playProgresses: many(playProgress),
	quizAttempts: many(quizAttempt),
	dailyBreadAttempts: many(dailyBreadAttempt),
	challenges_opponentId: many(challenge, {
		relationName: "challenge_opponentId_user_id"
	}),
	challenges_creatorId: many(challenge, {
		relationName: "challenge_creatorId_user_id"
	}),
	challengeParticipants: many(challengeParticipant),
	earnedBadges: many(earnedBadge),
	notifications: many(notification),
	loginHistories: many(loginHistory),
	gameScores: many(gameScore),
	dailyVerseLikes: many(dailyVerseLike),
	bookComments: many(bookComment),
	bookReactions: many(bookReaction),
	mediaLikes: many(mediaLike),
	postReports: many(postReport),
	commentReactions: many(commentReaction),
	comments: many(comment),
	chatClears: many(chatClear),
	devotionDayLikes: many(devotionDayLike),
	subscriptions: many(subscription),
	userMedias: many(userMedia),
	communityJoinRequests: many(communityJoinRequest),
	communities: many(community),
	communityMembers: many(communityMember),
	communityMessageLikes: many(communityMessageLike),
	communityMessageBookmarks: many(communityMessageBookmark),
	communityMessageComments: many(communityMessageComment),
	savedBooks: many(savedBook),
	communityDailyVerseLikes: many(communityDailyVerseLike),
	communityMessageReactions: many(communityMessageReaction),
	communityMessageCommentLikes: many(communityMessageCommentLike),
	communityMessages: many(communityMessage),
	reports: many(report),
	coinTransactions: many(coinTransaction),
	books: many(book),
	devotionPlans: many(devotionPlan),
}));

export const userFeelingRelations = relations(userFeeling, ({one}) => ({
	user: one(user, {
		fields: [userFeeling.userId],
		references: [user.id]
	}),
}));

export const friendRequestRelations = relations(friendRequest, ({one}) => ({
	user_receiverId: one(user, {
		fields: [friendRequest.receiverId],
		references: [user.id],
		relationName: "friendRequest_receiverId_user_id"
	}),
	user_senderId: one(user, {
		fields: [friendRequest.senderId],
		references: [user.id],
		relationName: "friendRequest_senderId_user_id"
	}),
}));

export const directChatRelations = relations(directChat, ({one, many}) => ({
	user_user2Id: one(user, {
		fields: [directChat.user2Id],
		references: [user.id],
		relationName: "directChat_user2Id_user_id"
	}),
	user_user1Id: one(user, {
		fields: [directChat.user1Id],
		references: [user.id],
		relationName: "directChat_user1Id_user_id"
	}),
	directMessages: many(directMessage),
	chatPins: many(chatPin),
	chatClears: many(chatClear),
}));

export const directMessageRelations = relations(directMessage, ({one}) => ({
	user: one(user, {
		fields: [directMessage.senderId],
		references: [user.id]
	}),
	directChat: one(directChat, {
		fields: [directMessage.chatId],
		references: [directChat.id]
	}),
}));

export const chatPinRelations = relations(chatPin, ({one}) => ({
	directChat: one(directChat, {
		fields: [chatPin.chatId],
		references: [directChat.id]
	}),
}));

export const journalEntryRelations = relations(journalEntry, ({one}) => ({
	user: one(user, {
		fields: [journalEntry.userId],
		references: [user.id]
	}),
}));

export const personalNoteRelations = relations(personalNote, ({one}) => ({
	user: one(user, {
		fields: [personalNote.userId],
		references: [user.id]
	}),
}));

export const postRelations = relations(post, ({one, many}) => ({
	user: one(user, {
		fields: [post.userId],
		references: [user.id]
	}),
	community: one(community, {
		fields: [post.communityId],
		references: [community.id]
	}),
	postReactions: many(postReaction),
	postReports: many(postReport),
	comments: many(comment),
}));

export const communityRelations = relations(community, ({one, many}) => ({
	posts: many(post),
	communityEvents: many(communityEvent),
	groupMessages: many(groupMessage),
	communityJoinRequests: many(communityJoinRequest),
	user: one(user, {
		fields: [community.creatorId],
		references: [user.id]
	}),
	communityMembers: many(communityMember),
	communityDailyVerses: many(communityDailyVerse),
	communityMessages: many(communityMessage),
}));

export const postReactionRelations = relations(postReaction, ({one}) => ({
	user: one(user, {
		fields: [postReaction.userId],
		references: [user.id]
	}),
	post: one(post, {
		fields: [postReaction.postId],
		references: [post.id]
	}),
}));

export const communityEventRelations = relations(communityEvent, ({one, many}) => ({
	community: one(community, {
		fields: [communityEvent.communityId],
		references: [community.id]
	}),
	eventAttendees: many(eventAttendee),
}));

export const eventAttendeeRelations = relations(eventAttendee, ({one}) => ({
	user: one(user, {
		fields: [eventAttendee.userId],
		references: [user.id]
	}),
	communityEvent: one(communityEvent, {
		fields: [eventAttendee.eventId],
		references: [communityEvent.id]
	}),
}));

export const groupMessageRelations = relations(groupMessage, ({one}) => ({
	user: one(user, {
		fields: [groupMessage.senderId],
		references: [user.id]
	}),
	community: one(community, {
		fields: [groupMessage.communityId],
		references: [community.id]
	}),
}));

export const bibleBookmarkRelations = relations(bibleBookmark, ({one}) => ({
	user: one(user, {
		fields: [bibleBookmark.userId],
		references: [user.id]
	}),
}));

export const bibleHighlightRelations = relations(bibleHighlight, ({one}) => ({
	user: one(user, {
		fields: [bibleHighlight.userId],
		references: [user.id]
	}),
}));

export const bibleNoteRelations = relations(bibleNote, ({one}) => ({
	user: one(user, {
		fields: [bibleNote.userId],
		references: [user.id]
	}),
}));

export const bibleReadingHistoryRelations = relations(bibleReadingHistory, ({one}) => ({
	user: one(user, {
		fields: [bibleReadingHistory.userId],
		references: [user.id]
	}),
}));

export const devotionDayRelations = relations(devotionDay, ({one, many}) => ({
	devotionPlan: one(devotionPlan, {
		fields: [devotionDay.planId],
		references: [devotionPlan.id]
	}),
	devotionDayLikes: many(devotionDayLike),
}));

export const devotionPlanRelations = relations(devotionPlan, ({one, many}) => ({
	devotionDays: many(devotionDay),
	user: one(user, {
		fields: [devotionPlan.authorId],
		references: [user.id]
	}),
}));

export const userPlanProgressRelations = relations(userPlanProgress, ({one}) => ({
	user: one(user, {
		fields: [userPlanProgress.userId],
		references: [user.id]
	}),
}));

export const playProgressRelations = relations(playProgress, ({one}) => ({
	sermonMedia: one(sermonMedia, {
		fields: [playProgress.mediaId],
		references: [sermonMedia.id]
	}),
	user: one(user, {
		fields: [playProgress.userId],
		references: [user.id]
	}),
}));

export const sermonMediaRelations = relations(sermonMedia, ({many}) => ({
	playProgresses: many(playProgress),
	mediaLikes: many(mediaLike),
}));

export const questionRelations = relations(question, ({one}) => ({
	quiz: one(quiz, {
		fields: [question.quizId],
		references: [quiz.id]
	}),
}));

export const quizRelations = relations(quiz, ({many}) => ({
	questions: many(question),
	quizAttempts: many(quizAttempt),
}));

export const quizAttemptRelations = relations(quizAttempt, ({one}) => ({
	quiz: one(quiz, {
		fields: [quizAttempt.quizId],
		references: [quiz.id]
	}),
	user: one(user, {
		fields: [quizAttempt.userId],
		references: [user.id]
	}),
}));

export const dailyBreadAttemptRelations = relations(dailyBreadAttempt, ({one}) => ({
	dailyBread: one(dailyBread, {
		fields: [dailyBreadAttempt.dailyBreadId],
		references: [dailyBread.id]
	}),
	user: one(user, {
		fields: [dailyBreadAttempt.userId],
		references: [user.id]
	}),
}));

export const dailyBreadRelations = relations(dailyBread, ({many}) => ({
	dailyBreadAttempts: many(dailyBreadAttempt),
}));

export const challengeRelations = relations(challenge, ({one, many}) => ({
	user_opponentId: one(user, {
		fields: [challenge.opponentId],
		references: [user.id],
		relationName: "challenge_opponentId_user_id"
	}),
	user_creatorId: one(user, {
		fields: [challenge.creatorId],
		references: [user.id],
		relationName: "challenge_creatorId_user_id"
	}),
	challengeParticipants: many(challengeParticipant),
}));

export const challengeParticipantRelations = relations(challengeParticipant, ({one}) => ({
	user: one(user, {
		fields: [challengeParticipant.userId],
		references: [user.id]
	}),
	challenge: one(challenge, {
		fields: [challengeParticipant.challengeId],
		references: [challenge.id]
	}),
}));

export const earnedBadgeRelations = relations(earnedBadge, ({one}) => ({
	badge: one(badge, {
		fields: [earnedBadge.badgeId],
		references: [badge.id]
	}),
	user: one(user, {
		fields: [earnedBadge.userId],
		references: [user.id]
	}),
}));

export const badgeRelations = relations(badge, ({many}) => ({
	earnedBadges: many(earnedBadge),
}));

export const notificationRelations = relations(notification, ({one}) => ({
	user: one(user, {
		fields: [notification.userId],
		references: [user.id]
	}),
}));

export const loginHistoryRelations = relations(loginHistory, ({one}) => ({
	user: one(user, {
		fields: [loginHistory.userId],
		references: [user.id]
	}),
}));

export const gameScoreRelations = relations(gameScore, ({one}) => ({
	user: one(user, {
		fields: [gameScore.userId],
		references: [user.id]
	}),
}));

export const dailyVerseLikeRelations = relations(dailyVerseLike, ({one}) => ({
	user: one(user, {
		fields: [dailyVerseLike.userId],
		references: [user.id]
	}),
}));

export const bookCommentRelations = relations(bookComment, ({one}) => ({
	user: one(user, {
		fields: [bookComment.userId],
		references: [user.id]
	}),
	book: one(book, {
		fields: [bookComment.bookId],
		references: [book.id]
	}),
}));

export const bookRelations = relations(book, ({one, many}) => ({
	bookComments: many(bookComment),
	bookReactions: many(bookReaction),
	savedBooks: many(savedBook),
	user: one(user, {
		fields: [book.authorId],
		references: [user.id]
	}),
}));

export const bookReactionRelations = relations(bookReaction, ({one}) => ({
	user: one(user, {
		fields: [bookReaction.userId],
		references: [user.id]
	}),
	book: one(book, {
		fields: [bookReaction.bookId],
		references: [book.id]
	}),
}));

export const mediaLikeRelations = relations(mediaLike, ({one}) => ({
	sermonMedia: one(sermonMedia, {
		fields: [mediaLike.mediaId],
		references: [sermonMedia.id]
	}),
	user: one(user, {
		fields: [mediaLike.userId],
		references: [user.id]
	}),
}));

export const postReportRelations = relations(postReport, ({one}) => ({
	user: one(user, {
		fields: [postReport.userId],
		references: [user.id]
	}),
	post: one(post, {
		fields: [postReport.postId],
		references: [post.id]
	}),
}));

export const commentReactionRelations = relations(commentReaction, ({one}) => ({
	comment: one(comment, {
		fields: [commentReaction.commentId],
		references: [comment.id]
	}),
	user: one(user, {
		fields: [commentReaction.userId],
		references: [user.id]
	}),
}));

export const commentRelations = relations(comment, ({one, many}) => ({
	commentReactions: many(commentReaction),
	comment: one(comment, {
		fields: [comment.parentId],
		references: [comment.id],
		relationName: "comment_parentId_comment_id"
	}),
	comments: many(comment, {
		relationName: "comment_parentId_comment_id"
	}),
	post: one(post, {
		fields: [comment.postId],
		references: [post.id]
	}),
	user: one(user, {
		fields: [comment.userId],
		references: [user.id]
	}),
}));

export const chatClearRelations = relations(chatClear, ({one}) => ({
	user: one(user, {
		fields: [chatClear.userId],
		references: [user.id]
	}),
	directChat: one(directChat, {
		fields: [chatClear.chatId],
		references: [directChat.id]
	}),
}));

export const devotionDayLikeRelations = relations(devotionDayLike, ({one}) => ({
	devotionDay: one(devotionDay, {
		fields: [devotionDayLike.dayId],
		references: [devotionDay.id]
	}),
	user: one(user, {
		fields: [devotionDayLike.userId],
		references: [user.id]
	}),
}));

export const subscriptionRelations = relations(subscription, ({one}) => ({
	user: one(user, {
		fields: [subscription.userId],
		references: [user.id]
	}),
}));

export const userMediaRelations = relations(userMedia, ({one}) => ({
	user: one(user, {
		fields: [userMedia.userId],
		references: [user.id]
	}),
}));

export const communityJoinRequestRelations = relations(communityJoinRequest, ({one}) => ({
	community: one(community, {
		fields: [communityJoinRequest.communityId],
		references: [community.id]
	}),
	user: one(user, {
		fields: [communityJoinRequest.userId],
		references: [user.id]
	}),
}));

export const communityMemberRelations = relations(communityMember, ({one}) => ({
	community: one(community, {
		fields: [communityMember.communityId],
		references: [community.id]
	}),
	user: one(user, {
		fields: [communityMember.userId],
		references: [user.id]
	}),
}));

export const communityMessageLikeRelations = relations(communityMessageLike, ({one}) => ({
	communityMessage: one(communityMessage, {
		fields: [communityMessageLike.messageId],
		references: [communityMessage.id]
	}),
	user: one(user, {
		fields: [communityMessageLike.userId],
		references: [user.id]
	}),
}));

export const communityMessageRelations = relations(communityMessage, ({one, many}) => ({
	communityMessageLikes: many(communityMessageLike),
	communityMessageBookmarks: many(communityMessageBookmark),
	communityMessageComments: many(communityMessageComment),
	communityMessageReactions: many(communityMessageReaction),
	community: one(community, {
		fields: [communityMessage.communityId],
		references: [community.id]
	}),
	user: one(user, {
		fields: [communityMessage.senderId],
		references: [user.id]
	}),
}));

export const communityMessageBookmarkRelations = relations(communityMessageBookmark, ({one}) => ({
	communityMessage: one(communityMessage, {
		fields: [communityMessageBookmark.messageId],
		references: [communityMessage.id]
	}),
	user: one(user, {
		fields: [communityMessageBookmark.userId],
		references: [user.id]
	}),
}));

export const communityMessageCommentRelations = relations(communityMessageComment, ({one, many}) => ({
	communityMessageComment: one(communityMessageComment, {
		fields: [communityMessageComment.parentId],
		references: [communityMessageComment.id],
		relationName: "communityMessageComment_parentId_communityMessageComment_id"
	}),
	communityMessageComments: many(communityMessageComment, {
		relationName: "communityMessageComment_parentId_communityMessageComment_id"
	}),
	communityMessage: one(communityMessage, {
		fields: [communityMessageComment.messageId],
		references: [communityMessage.id]
	}),
	user: one(user, {
		fields: [communityMessageComment.userId],
		references: [user.id]
	}),
	communityMessageCommentLikes: many(communityMessageCommentLike),
}));

export const savedBookRelations = relations(savedBook, ({one}) => ({
	book: one(book, {
		fields: [savedBook.bookId],
		references: [book.id]
	}),
	user: one(user, {
		fields: [savedBook.userId],
		references: [user.id]
	}),
}));

export const communityDailyVerseRelations = relations(communityDailyVerse, ({one, many}) => ({
	community: one(community, {
		fields: [communityDailyVerse.communityId],
		references: [community.id]
	}),
	communityDailyVerseLikes: many(communityDailyVerseLike),
}));

export const communityDailyVerseLikeRelations = relations(communityDailyVerseLike, ({one}) => ({
	communityDailyVerse: one(communityDailyVerse, {
		fields: [communityDailyVerseLike.verseId],
		references: [communityDailyVerse.id]
	}),
	user: one(user, {
		fields: [communityDailyVerseLike.userId],
		references: [user.id]
	}),
}));

export const communityMessageReactionRelations = relations(communityMessageReaction, ({one}) => ({
	communityMessage: one(communityMessage, {
		fields: [communityMessageReaction.messageId],
		references: [communityMessage.id]
	}),
	user: one(user, {
		fields: [communityMessageReaction.userId],
		references: [user.id]
	}),
}));

export const communityMessageCommentLikeRelations = relations(communityMessageCommentLike, ({one}) => ({
	communityMessageComment: one(communityMessageComment, {
		fields: [communityMessageCommentLike.commentId],
		references: [communityMessageComment.id]
	}),
	user: one(user, {
		fields: [communityMessageCommentLike.userId],
		references: [user.id]
	}),
}));

export const reportRelations = relations(report, ({one}) => ({
	user: one(user, {
		fields: [report.userId],
		references: [user.id]
	}),
}));

export const coinTransactionRelations = relations(coinTransaction, ({one}) => ({
	user: one(user, {
		fields: [coinTransaction.userId],
		references: [user.id]
	}),
}));