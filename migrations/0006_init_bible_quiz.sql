-- CreateTable
CREATE TABLE "BibleQuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionText" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctAnswerIndex" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'easy',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
