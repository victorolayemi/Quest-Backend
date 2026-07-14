-- ============================================================
-- Seed data for local D1 database (dates stored as ISO text)
-- ============================================================

-- Users
INSERT INTO "User" (id, email, phoneNumber, password, firstName, lastName, username, gender, isAdmin, isBanned, isGuest, points, streakCount, avatarUrl, bio, location, appearance, soundAlerts, hapticFeedback, music, allNotifications, inAppNotifications, doNotDisturb, reminderMorning, reminderAfternoon, reminderEvening, createdAt, updatedAt)
VALUES
  ('user-1', 'john@example.com', '+15550101', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'John', 'Doe', 'johndoe', 'Male', 1, 0, 0, 150, 5, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80', 'Just a follower of Christ seeking truth.', 'Dallas, TX', 'system', 1, 1, 1, 1, 1, 0, 0, 0, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('user-2', 'jane@example.com', '+15550102', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Jane', 'Smith', 'janesmith', 'Female', 0, 0, 0, 320, 12, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', 'Worship leader and bible study coordinator.', 'Austin, TX', 'system', 1, 1, 1, 1, 1, 0, 0, 0, 0, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z');

-- Devotion Plans
INSERT INTO "DevotionPlan" (id, title, description, durationDays, authorName, authorHandle, tag, createdAt)
VALUES
  ('plan-1', 'Walking in Faith', 'A 3-day journey exploring what it means to live by faith, not by sight.', 3, 'Pastor David Chan', '@davidchan', 'Faith', '2026-01-01T00:00:00.000Z');

-- Devotion Days
INSERT INTO "DevotionDay" (id, planId, dayNumber, title, bodyText, pointsEarned, likesCount, createdAt)
VALUES
  ('day-1', 'plan-1', 1, 'Trusting the Invisible', 'Faith starts where our sight ends. Abraham went out, not knowing where he was going. Trust that God has already walked the path ahead of you.', 20, 0, '2026-01-01T00:00:00.000Z'),
  ('day-2', 'plan-1', 2, 'The Shield of Faith', 'In every battle, faith is our shield. It deflects the fiery darts of doubt and fear. Hold it high today.', 20, 0, '2026-01-01T00:00:00.000Z'),
  ('day-3', 'plan-1', 3, 'Faith in Action', 'Faith without works is dead. How will your actions reflect your trust in God today? Step out and love boldly.', 20, 0, '2026-01-01T00:00:00.000Z');

-- Sermon Media
INSERT INTO "SermonMedia" (id, title, author, likes, mediaUrl, imageUrl, type, duration, category, createdAt)
VALUES
  ('media-1', 'Overcoming Anxiety', 'Pastor John MacArthur', 120, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=300&q=80', 'AUDIO', '12:45', 'Sermon', '2026-01-01T00:00:00.000Z'),
  ('media-2', 'The Grace of God', 'Alistair Begg', 85, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=300&q=80', 'AUDIO', '18:12', 'Grace', '2026-01-01T00:00:00.000Z'),
  ('media-3', 'The Power of Prayer', 'Timothy Keller', 203, 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80', 'VIDEO', '24:10', 'Prayer', '2026-01-02T00:00:00.000Z'),
  ('media-4', 'Walking in the Spirit', 'Charles Stanley', 145, 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_2mb.mp4', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=300&q=80', 'VIDEO', '31:05', 'Holy Spirit', '2026-01-03T00:00:00.000Z');

-- Quizzes
INSERT INTO "Quiz" (id, title, category, difficulty, points, createdAt)
VALUES
  ('quiz-1', 'Life of David', 'History', 'Medium', 50, '2026-01-01T00:00:00.000Z');

-- Questions
INSERT INTO "Question" (id, quizId, questionText, options, correctAnswerIndex, points)
VALUES
  ('q-1', 'quiz-1', 'What instrument did David play for Saul?', '["Harp","Flute","Trumpet","Lyre"]', 0, 10),
  ('q-2', 'quiz-1', 'Who was David''s best friend?', '["Jonathan","Absalom","Abner","Joab"]', 0, 10);

-- Daily Bread
INSERT INTO "DailyBread" (id, date, puzzleData, solution)
VALUES
  ('bread-1', '2026-05-30', '["F","A","I","T","H"]', 'FAITH');

-- Badges
INSERT INTO "Badge" (id, name, description, imageUrl, criteriaType, criteriaValue)
VALUES
  ('badge-1', 'Word Explorer', 'Complete your first bible reading chapter', 'https://cdn-icons-png.flaticon.com/512/6187/6187010.png', 'READ_CHAPTER', 1),
  ('badge-2', 'Prayer Warrior', 'Keep a 7-day journal streak', 'https://cdn-icons-png.flaticon.com/512/2972/2972134.png', 'JOURNAL_STREAK', 7);

-- App Features
INSERT INTO "AppFeature" (id, key, isEnabled, createdAt, updatedAt)
VALUES
  ('feat-journal',       'journal',       1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('feat-devotion',      'devotion',      1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('feat-videos',        'videos',        1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('feat-audio',         'audioMessages', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('feat-community',     'community',     1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('feat-connect',       'connect',       1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('feat-games',         'games',         1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Community
INSERT INTO "Community" (id, name, description, image, guidelines, createdAt)
VALUES
  ('comm-1', 'Young Adults Fellowship', 'A place for college students and young professionals to discuss faith, life, and scripture.', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=300&q=80', 'Respect each other and keep the conversation biblical.', '2026-01-01T00:00:00.000Z');

-- Community Members
INSERT INTO "CommunityMember" (id, communityId, userId, role, joinedAt)
VALUES
  ('cm-1', 'comm-1', 'user-1', 'ADMIN',  '2026-01-01T00:00:00.000Z'),
  ('cm-2', 'comm-1', 'user-2', 'MEMBER', '2026-01-02T00:00:00.000Z');

-- Sample Journal Entry (for user-1 so home screen shows it)
INSERT INTO "JournalEntry" (id, userId, title, bodyText, feelings, verses, createdAt)
VALUES
  ('journal-1', 'user-1', 'My First Journal', 'Today I read Psalm 23 and felt an overwhelming sense of peace. Grateful for God''s guidance.', '["Grateful"]', '["Psalm 23:1"]', '2026-05-30T08:00:00.000Z');
