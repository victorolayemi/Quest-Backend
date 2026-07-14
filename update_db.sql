UPDATE DevotionPlan SET image = 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=800&q=80' WHERE image LIKE '%assets/%' OR image LIKE '%1529156069898-49953eb1b5e4%';
UPDATE DevotionDay SET videoUrl = 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80' WHERE videoUrl LIKE '%assets/%';
UPDATE Community SET image = 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=800&q=80' WHERE image LIKE '%assets/%';
UPDATE User SET avatarUrl = 'https://images.unsplash.com/photo-1493612276216-ee3925520721?auto=format&fit=crop&w=800&q=80' WHERE avatarUrl LIKE '%assets/%';
UPDATE CommunityEvent SET imageUrl = 'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?auto=format&fit=crop&w=800&q=80' WHERE imageUrl LIKE '%assets/%';
