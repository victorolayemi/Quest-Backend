import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Game Settings...");

  // Create or Update Game Settings
  await prisma.gameSettings.upsert({
    where: { gameType: "WORD_MATCH" },
    update: {},
    create: {
      gameType: "WORD_MATCH",
      totalQuestions: 10,
      durationSecs: 120,
    },
  });

  await prisma.gameSettings.upsert({
    where: { gameType: "WORD_CROSS" },
    update: {},
    create: {
      gameType: "WORD_CROSS",
      totalQuestions: 10,
      durationSecs: 300,
    },
  });

  await prisma.gameSettings.upsert({
    where: { gameType: "BIBLE_QUIZ" },
    update: {},
    create: {
      gameType: "BIBLE_QUIZ",
      totalQuestions: 10,
      durationSecs: 120,
    },
  });

  console.log("Seeding Word Match Questions...");

  const wordMatchQuestions = [
    { word: "Jesus", match: "Son of God", difficulty: "easy" },
    { word: "Genesis", match: "  book of the Bible", difficulty: "easy" },
    { word: "Moses", match: "Parted the Red Sea", difficulty: "easy" },
    { word: "David", match: "Defeated Goliath", difficulty: "medium" },
    { word: "Paul", match: "Wrote many Epistles", difficulty: "medium" },
    { word: "Solomon", match: "Known for his wisdom", difficulty: "medium" },
    { word: "Methuselah", match: "Lived 969 years", difficulty: "hard" },
    { word: "Melchizedek", match: "King of Salem", difficulty: "hard" },
    { word: "Balaam", match: "His donkey spoke", difficulty: "hard" },
    {
      word: "Zacchaeus",
      match: "Climbed a sycamore tree",
      difficulty: "medium",
    },
  ];

  for (const q of wordMatchQuestions) {
    await prisma.wordMatchQuestion.create({ data: q });
  }

  console.log("Seeding Word Cross Questions...");

  const wordCrossQuestions = [
    {
      word: "GOLIATH",
      clue: "Giant Philistine warrior defeated by a boy with a sling.",
      difficulty: "easy",
    },
    {
      word: "BETHLEHEM",
      clue: "The birthplace of Jesus Christ.",
      difficulty: "easy",
    },
    {
      word: "REVELATION",
      clue: "The final book of the New Testament.",
      difficulty: "easy",
    },
    {
      word: "GABRIEL",
      clue: "The angel who announced the birth of Jesus to Mary.",
      difficulty: "medium",
    },
    {
      word: "LAZARUS",
      clue: "Raised from the dead by Jesus after four days.",
      difficulty: "medium",
    },
    {
      word: "SAMSON",
      clue: "Known for his incredible strength, which was lost when his hair was cut.",
      difficulty: "medium",
    },
    {
      word: "NEBUCHADNEZZAR",
      clue: "Babylonian king who built the hanging gardens and destroyed the first temple.",
      difficulty: "hard",
    },
    {
      word: "ZERUBBABEL",
      clue: "Led the first group of Jews returning from the Babylonian captivity.",
      difficulty: "hard",
    },
    {
      word: "EPHESUS",
      clue: "A major city where Paul stayed for over two years, and the recipient of one of his epistles.",
      difficulty: "hard",
    },
    {
      word: "PENTECOST",
      clue: "The festival when the Holy Spirit descended upon the apostles.",
      difficulty: "medium",
    },
  ];

  for (const q of wordCrossQuestions) {
    await prisma.wordCrossQuestion.create({ data: q });
  }

  console.log("Seeding Bible Quiz Questions...");

  const bibleQuizQuestions = [
    {
      questionText: "Who built the ark?",
      options: JSON.stringify(["Moses", "Noah", "Abraham", "David"]),
      correctAnswerIndex: 1,
      level: 1,
    },
    {
      questionText: "How many days and nights did it rain during the flood?",
      options: JSON.stringify(["10", "40", "100", "7"]),
      correctAnswerIndex: 1,
      level: 1,
    },
    {
      questionText: "What was the first plague of Egypt?",
      options: JSON.stringify(["Frogs", "Locusts", "Water turned to blood", "Hail"]),
      correctAnswerIndex: 2,
      level: 2,
    },
    {
      questionText: "Who was the oldest man in the Bible?",
      options: JSON.stringify(["Adam", "Noah", "Methuselah", "Enoch"]),
      correctAnswerIndex: 2,
      level: 3,
    },
  ];

  for (const q of bibleQuizQuestions) {
    await prisma.bibleQuizQuestion.create({ data: q });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
