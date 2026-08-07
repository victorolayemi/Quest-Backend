const fs = require('fs');

const replacements = [
  { file: 'src/routes/communities/core.ts', finds: ['eq(,', 'eq(,'], replaces: ['eq(communityMember.userId,', 'eq(communityJoinRequest.userId,'] },
  { file: 'src/routes/communities/core.ts', finds: ['eq(,', 'eq(,'], replaces: ['eq(communityMember.userId,', 'eq(communityJoinRequest.userId,'] }, // wait, simple string replace replaces only first occurrence. I can just do it line by line or with a regex based on surrounding text.
];

const filesAndReplaces = {
  'src/routes/communities/core.ts': [
    { lineStart: 'where(eq(', replacement: 'where(eq(communityMember.userId,' },
    { lineStart: 'and(eq(communityMember.communityId, id), eq(', replacement: 'and(eq(communityMember.communityId, id), eq(communityMember.userId,' },
    { lineStart: 'and(eq(communityJoinRequest.communityId, id), eq(', replacement: 'and(eq(communityJoinRequest.communityId, id), eq(communityJoinRequest.userId,' },
  ],
  'src/routes/communities/events.ts': [
    { lineStart: 'not(eq(', replacement: 'not(eq(communityMember.userId,' },
    { lineStart: 'eq(communityMember.communityId, communityId), eq(', replacement: 'eq(communityMember.communityId, communityId), eq(communityMember.userId,' },
    { lineStart: 'eq(eventAttendee.eventId, eventId), eq(', replacement: 'eq(eventAttendee.eventId, eventId), eq(eventAttendee.userId,' }
  ],
  'src/routes/communities/forum.ts': [
    { lineStart: 'eq(communityMember.communityId, msg.communityId), eq(', replacement: 'eq(communityMember.communityId, msg.communityId), eq(communityMember.userId,' }
  ],
  'src/routes/communities/members.ts': [
    { lineStart: 'eq(communityMember.communityId, communityId), eq(', replacement: 'eq(communityMember.communityId, communityId), eq(communityMember.userId,' },
    { lineStart: 'eq(communityJoinRequest.communityId, communityId), eq(', replacement: 'eq(communityJoinRequest.communityId, communityId), eq(communityJoinRequest.userId,' }
  ],
  'src/routes/communities/messages.ts': [
    { lineStart: 'where(and(eq(', replacement: 'where(and(eq(communityMessageBookmark.userId,' },
    { lineStart: 'where(eq(', replacement: 'where(eq(communityMember.userId,' },
    { lineStart: 'and(eq(', replacement: 'and(eq(' } // wait, I can just replace all 'eq(,' with a function that checks surrounding text? Or I can just write a generic replacer!
  ]
};

// Instead of mapping manually, I will parse the code. If we see `eq(, userId as string)` and we look closely, the previous `eq` or the context usually tells us the table, BUT we don't have AST easily accessible.

// Let's use string.replace with regex over the whole file content.
function fixFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  let lines = content.split('\n');
  for (let i=0; i<lines.length; i++) {
    if (lines[i].includes('eq(, userId as string)')) {
      if (lines[i].includes('communityMember')) lines[i] = lines[i].replace('eq(, userId as string)', 'eq(communityMember.userId, userId as string)');
      else if (lines[i].includes('communityJoinRequest')) lines[i] = lines[i].replace('eq(, userId as string)', 'eq(communityJoinRequest.userId, userId as string)');
      else if (lines[i].includes('eventAttendee')) lines[i] = lines[i].replace('eq(, userId as string)', 'eq(eventAttendee.userId, userId as string)');
      else if (lines[i].includes('communityMessageBookmark')) lines[i] = lines[i].replace('eq(, userId as string)', 'eq(communityMessageBookmark.userId, userId as string)');
      else if (lines[i].includes('communityMessageLike')) lines[i] = lines[i].replace('eq(, userId as string)', 'eq(communityMessageLike.userId, userId as string)');
      else if (lines[i].includes('communityMessageReaction')) lines[i] = lines[i].replace('eq(, userId as string)', 'eq(communityMessageReaction.userId, userId as string)');
      else if (lines[i].includes('communityMessageCommentLike')) lines[i] = lines[i].replace('eq(, userId as string)', 'eq(communityMessageCommentLike.userId, userId as string)');
      else if (lines[i].includes('postReaction')) lines[i] = lines[i].replace('eq(, userId as string)', 'eq(postReaction.userId, userId as string)');
      else if (lines[i].includes('commentReaction')) lines[i] = lines[i].replace('eq(, userId as string)', 'eq(commentReaction.userId, userId as string)');
      else if (lines[i].includes('communityDailyVerseLike')) lines[i] = lines[i].replace('eq(, userId as string)', 'eq(communityDailyVerseLike.userId, userId as string)');
    }
  }
  
  // Also some lines might have eq(, userId as string) but only have `community.` etc.
  fs.writeFileSync(path, lines.join('\n'));
}

const dir = 'src/routes/communities/';
fs.readdirSync(dir).filter(f=>f.endsWith('.ts')).forEach(f => fixFile(dir+f));

