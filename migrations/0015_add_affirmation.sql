CREATE TABLE "Affirmation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feeling" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed Affirmations
-- Default / General (feeling is NULL)
INSERT INTO "Affirmation" (id, feeling, text) VALUES
  ('general-1', NULL, 'God loves me, and I know it'),
  ('general-2', NULL, 'The Lord is my shepherd, I lack nothing. (Psalm 23:1)'),
  ('general-3', NULL, 'I can do all things through Christ who strengthens me. (Philippians 4:13)'),
  ('general-4', NULL, 'God is my refuge and strength, an ever-present help in trouble. (Psalm 46:1)');

-- Sad
INSERT INTO "Affirmation" (id, feeling, text) VALUES
  ('sad-1', 'Sad', 'The Lord is close to the brokenhearted and saves those who are crushed in spirit. (Psalm 34:18)'),
  ('sad-2', 'Sad', 'He heals the brokenhearted and binds up their wounds. (Psalm 147:3)'),
  ('sad-3', 'Sad', 'Weeping may stay for the night, but rejoicing comes in the morning. (Psalm 30:5)');

-- Anxious
INSERT INTO "Affirmation" (id, feeling, text) VALUES
  ('anxious-1', 'Anxious', 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. (Philippians 4:6)'),
  ('anxious-2', 'Anxious', 'Cast all your anxiety on him because he cares for you. (1 Peter 5:7)'),
  ('anxious-3', 'Anxious', 'When anxiety was great within me, your consolation brought me joy. (Psalm 94:19)');

-- Hopeful
INSERT INTO "Affirmation" (id, feeling, text) VALUES
  ('hopeful-1', 'Hopeful', 'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future. (Jeremiah 29:11)'),
  ('hopeful-2', 'Hopeful', 'May the God of hope fill you with all joy and peace as you trust in him, so that you may overflow with hope by the power of the Holy Spirit. (Romans 15:13)'),
  ('hopeful-3', 'Hopeful', 'But those who hope in the Lord will renew their strength. They will soar on wings like eagles. (Isaiah 40:31)');

-- Thankful
INSERT INTO "Affirmation" (id, feeling, text) VALUES
  ('thankful-1', 'Thankful', 'Give thanks to the Lord, for he is good; his love endures forever. (Psalm 107:1)'),
  ('thankful-2', 'Thankful', 'Give thanks in all circumstances; for this is God''s will for you in Christ Jesus. (1 Thessalonians 5:18)'),
  ('thankful-3', 'Thankful', 'Enter his gates with thanksgiving and his courts with praise; give thanks to him and praise his name. (Psalm 100:4)');

-- Peaceful
INSERT INTO "Affirmation" (id, feeling, text) VALUES
  ('peaceful-1', 'Peaceful', 'And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus. (Philippians 4:7)'),
  ('peaceful-2', 'Peaceful', 'Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid. (John 14:27)'),
  ('peaceful-3', 'Peaceful', 'You will keep in perfect peace those whose minds are steadfast, because they trust in you. (Isaiah 26:3)');

-- Blessed
INSERT INTO "Affirmation" (id, feeling, text) VALUES
  ('blessed-1', 'Blessed', 'Blessed is the one who trusts in the Lord, whose confidence is in him. (Jeremiah 17:7)'),
  ('blessed-2', 'Blessed', 'The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you. (Numbers 6:24-25)'),
  ('blessed-3', 'Blessed', 'Praise be to the God and Father of our Lord Jesus Christ, who has blessed us in the heavenly realms with every spiritual blessing in Christ. (Ephesians 1:3)');

-- Joyful
INSERT INTO "Affirmation" (id, feeling, text) VALUES
  ('joyful-1', 'Joyful', 'The joy of the Lord is your strength. (Nehemiah 8:10)'),
  ('joyful-2', 'Joyful', 'Though you have not seen him, you love him; and even though you do not see him now, you believe in him and are filled with an inexpressible and glorious joy. (1 Peter 1:8)'),
  ('joyful-3', 'Joyful', 'This is the day the Lord has made; let us rejoice and be glad in it. (Psalm 118:24)');
