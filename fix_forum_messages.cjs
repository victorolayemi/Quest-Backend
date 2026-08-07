const fs = require('fs');

let forum = fs.readFileSync('src/routes/communities/forum.ts', 'utf8');
forum = forum.replace(/senderId: senderId,/g, 'senderId: senderId as string,');
forum = forum.replace(/eq\\(communityMember.communityId, msg.communityId\\)/g, 'eq(communityMember.communityId, msg.communityId as string)');
fs.writeFileSync('src/routes/communities/forum.ts', forum);

let msgs = fs.readFileSync('src/routes/communities/messages.ts', 'utf8');
msgs = msgs.replace(/sender: \\{/g, 'user: {');
msgs = msgs.replace(/eq\\(communityMember.communityId, communityId\\)/g, 'eq(communityMember.communityId, communityId as string)');
msgs = msgs.replace(/senderId: senderId,/g, 'senderId: senderId as string,');
msgs = msgs.replace(/comments: \\{/g, 'communityMessageComment: {'); // the relation for replies might be communityMessageComment (itself)? Wait...
fs.writeFileSync('src/routes/communities/messages.ts', msgs);

let verse = fs.readFileSync('src/routes/communities/verse.ts', 'utf8');
verse = verse.replace(/new Date\\(\\)\\)\\.split/g, 'new Date()).toISOString().split');
fs.writeFileSync('src/routes/communities/verse.ts', verse);
