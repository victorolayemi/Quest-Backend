const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');

const project = new Project();
const sourceFile = project.addSourceFileAtPath('src/routes/communities.ts');

const coreRoutes = [];
const postsRoutes = [];
const membersRoutes = [];
const messagesRoutes = [];
const eventsRoutes = [];
const forumRoutes = [];
const verseRoutes = [];
const unmappedRoutes = [];

function getCategory(pathStr) {
  if (pathStr.includes('verse-today')) return 'verse';
  if (pathStr.includes('forum')) return 'forum';
  if (pathStr.includes('events')) return 'events';
  if (pathStr.includes('messages')) return 'messages';
  if (pathStr.includes('join') || pathStr.includes('leave') || pathStr.includes('requests') || pathStr.includes('members')) return 'members';
  if (pathStr.includes('posts') || pathStr.includes('comments')) return 'posts';
  return 'core';
}

const statements = sourceFile.getStatements();
const imports = [];
const others = [];

for (const stmt of statements) {
  if (stmt.getKind() === SyntaxKind.ImportDeclaration) {
    imports.push(stmt.getText());
    continue;
  }
  
  if (stmt.getKind() === SyntaxKind.VariableStatement && stmt.getText().includes('new Hono')) {
    others.push(stmt.getText());
    continue;
  }
  
  if (stmt.getKind() === SyntaxKind.ExpressionStatement) {
    const expr = stmt.getExpression();
    if (expr.getKind() === SyntaxKind.CallExpression) {
      const propAccess = expr.getExpression();
      if (propAccess.getKind() === SyntaxKind.PropertyAccessExpression && propAccess.getExpression().getText() === 'communities') {
        const args = expr.getArguments();
        if (args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral) {
          const pathStr = args[0].getLiteralValue();
          const category = getCategory(pathStr);
          
          let text = stmt.getText();
          text = text.replace(/^communities\./, 'app.');
          
          if (category === 'verse') verseRoutes.push(text);
          else if (category === 'forum') forumRoutes.push(text);
          else if (category === 'events') eventsRoutes.push(text);
          else if (category === 'messages') messagesRoutes.push(text);
          else if (category === 'members') membersRoutes.push(text);
          else if (category === 'posts') postsRoutes.push(text);
          else coreRoutes.push(text);
          continue;
        } else {
            // communities.use("*", ...)
            others.push(stmt.getText().replace(/^communities\./, 'app.'));
            continue;
        }
      }
    }
  }
  
  if (stmt.getKind() === SyntaxKind.ExportAssignment) {
    // export default communities;
    continue;
  }
  
  others.push(stmt.getText());
}

const outDir = 'src/routes/communities';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

function writeSubRoute(name, routes) {
  const content = `import { Hono } from 'hono';
import { getPrisma } from '../../utils/prisma';
import { Bindings, Variables } from '../../types';
import { checkAndDeductCoins } from '../../utils/economy';
import { authMiddleware, checkCommunityRestriction } from '../../middleware/auth';
import { adminAuthMiddleware } from '../../middleware/adminAuth';
import { FCMService } from '../../services/fcm';
import { dispatchNotification } from '../../services/notificationService';

const app = new Hono<{Bindings: Bindings, Variables: Variables}>();

${routes.join('\n\n')}

export default app;
`;
  fs.writeFileSync(path.join(outDir, `${name}.ts`), content);
}

writeSubRoute('core', [...others.filter(x => x.includes('function seed')), ...coreRoutes]);
writeSubRoute('posts', postsRoutes);
writeSubRoute('members', membersRoutes);
writeSubRoute('messages', messagesRoutes);
writeSubRoute('events', eventsRoutes);
writeSubRoute('forum', forumRoutes);
writeSubRoute('verse', verseRoutes);

const indexContent = `import { Hono } from 'hono';
import { Bindings, Variables } from '../../types';
import { authMiddleware } from '../../middleware/auth';

import coreRoutes from './core';
import postsRoutes from './posts';
import membersRoutes from './members';
import messagesRoutes from './messages';
import eventsRoutes from './events';
import forumRoutes from './forum';
import verseRoutes from './verse';

const communities = new Hono<{Bindings: Bindings, Variables: Variables}>();

communities.use("*", authMiddleware);

communities.route("/", coreRoutes);
communities.route("/", postsRoutes);
communities.route("/", membersRoutes);
communities.route("/", messagesRoutes);
communities.route("/", eventsRoutes);
communities.route("/", forumRoutes);
communities.route("/", verseRoutes);

export default communities;
`;

fs.writeFileSync(path.join(outDir, 'index.ts'), indexContent);
console.log("Split complete!");
