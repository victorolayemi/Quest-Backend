import { Hono } from 'hono';
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
