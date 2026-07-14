import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding devotions...");

  // 1. Faith Under Fire (5 Days)
  await prisma.devotionPlan.create({
    data: {
      title: "Faith Under Fire",
      description:
        "Strengthen your faith and resolve in the midst of challenging circumstances and life storms.",
      image: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=800&q=80",
      durationDays: 5,
      authorName: "Apostle Joshua Selman",
      authorHandle: "@joshuaselman",
      tag: "Faith & Resilience",
      days: {
        create: [
          {
            dayNumber: 1,
            title: "The Purpose of Trials",
            bodyText:
              "Trials are not meant to destroy you but to refine you. Just as gold is tried in the fire, your faith is purified when subjected to the heat of life's challenges. God uses difficult seasons to strip away self-dependence, forcing us to lean entirely on His grace. When you find yourself in the furnace of affliction, remember that the Master Craftsman is watching closely, adjusting the temperature to ensure that your character emerges flawless, lacking nothing, and perfectly prepared for the next level of your assignment.",
            pointsEarned: 20,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 2,
            title: "Anchored in the Word",
            bodyText:
              "When the winds of adversity blow, only those anchored deep in the Word of God will remain steadfast. Let the scripture be your ultimate reality, overriding the facts of your temporary situation. To be anchored means your emotional state, decisions, and confessions are not subject to the chaotic updates of this world. When you meditate on the Word day and night, you build a structural system within your spirit that cannot be shaken by financial storms, health challenges, or relational breakdowns.",
            pointsEarned: 20,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 3,
            title: "The Shield of Faith",
            bodyText:
              "Faith is your shield against the fiery darts of the enemy. It is a deliberate, active choice to trust God's unwavering character even when you cannot trace His hand in your current circumstances. The enemy will throw arrows of doubt, anxiety, and fear, targeting your mind. By lifting the shield of faith—which is built through a track record of intimacy with God—you extinguish every single lie. You must declare what God has spoken, knowing that He is too faithful to fail and too wise to make a mistake.",
            pointsEarned: 20,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 4,
            title: "Patience in the Process",
            bodyText:
              "God is never in a hurry, but He is always on time. Embrace the process and let patience have its perfect work in your life. The gap between the prophecy and the performance is called the process, and it is in this space that true spiritual stamina is formed. Do not try to bypass the wilderness, for it is the training ground for your destiny. Trust the timeline of God; he makes all things beautiful in its time, and those who wait upon Him will never be put to shame.",
            pointsEarned: 20,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1493612276216-ee3925520721?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 5,
            title: "Emerging Victorious",
            bodyText:
              "You will come out of this fire without the smell of smoke. The very situation that was orchestrated by the enemy to break your spirit will become the public testimony of your supernatural rising. God is turning your trial into a triumph and your mess into a timeless message. Stand firm and behold the salvation of the Lord. The storm you see today, you shall see no more forever, for your path is like the shining light that shines brighter and brighter unto the perfect day.",
            pointsEarned: 20,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?auto=format&fit=crop&w=800&q=80",
          },
        ],
      },
    },
  });

  // 2. Excellence in Leadership (3 Days)
  await prisma.devotionPlan.create({
    data: {
      title: "Excellence in Leadership",
      description:
        "Discover the principles of visionary leadership and impact in your generation.",
      image: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=800&q=80",
      durationDays: 3,
      authorName: "Pastor Sam Adeyemi",
      authorHandle: "@samadeyemi",
      tag: "Leadership & Success",
      days: {
        create: [
          {
            dayNumber: 1,
            title: "The Mind of a Leader",
            bodyText:
              "Leadership begins in the mind. You cannot lead people to a place you have not visited first in your own imagination, vision, and thinking. A true leader must break free from past limitations, paradigms of lack, and cultural constraints to see things from a dimension of possibilities. Your leadership capacity is strictly defined by your mental model. Spend time upgrading your mind through strategic learning, meditation on global principles, and listening to the blueprint of heaven for your generation.",
            pointsEarned: 25,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 2,
            title: "Service Above Self",
            bodyText:
              "True leadership is never about status, titles, or being served; it is entirely about serving others with excellence. The corporate world teaches power dynamics, but the kingdom teaches service dynamics. The greatest among you must be the servant of all. When your primary motivation shifts from personal gain to adding undeniable value to the lives of those you lead, you unlock a supernatural level of influence and respect that money cannot buy.",
            pointsEarned: 25,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 3,
            title: "Empowering Others",
            bodyText:
              "A highly successful leader is one who reproduces their success, wisdom, and core values in others. Your ultimate legacy as a leader is not measured by the number of followers you gather, but by the quality of leaders you successfully train, develop, and leave behind. Shift your focus from personal performance to institutional mentorship. Build platforms that empower the next generation to stand on your shoulders and excel far beyond your reach.",
            pointsEarned: 25,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=800&q=80",
          },
        ],
      },
    },
  });

  // 3. Walk in Love (3 Days)
  await prisma.devotionPlan.create({
    data: {
      title: "Walk in Love",
      description:
        "Explore what it truly means to walk in the perfect love of Christ daily.",
      image: "https://images.unsplash.com/photo-1493612276216-ee3925520721?auto=format&fit=crop&w=800&q=80",
      durationDays: 3,
      authorName: "Pastor Tunde",
      authorHandle: "@pastortunde",
      tag: "Love & Grace",
      days: {
        create: [
          {
            dayNumber: 1,
            title: "Love Defined",
            bodyText:
              "God is love. To know God intimately is to know love in its purest, most unconditional form. We cannot validly claim to follow Him if our daily lives, speech, and interactions do not reflect His nature. This love is not a fleeting emotional feeling based on human performance, but a sovereign decision to seek the absolute best for others, regardless of how they treat us. Let your life be a living conduit of this refreshing, restorative grace.",
            pointsEarned: 20,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 2,
            title: "Love in Action",
            bodyText:
              "Love is patient, love is kind. It does not envy, it does not boast, and it keeps no record of wrongs. Daily action validates the authenticity of our love walk. It is easy to speak of love conceptually, but the true test comes when we are required to extend forgiveness to those who hurt us, feed those who cannot repay us, and show patience to the difficult people in our workspace. Let love be your highest priority and your primary operational framework today.",
            pointsEarned: 20,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 3,
            title: "Love Conquers All",
            bodyText:
              "Perfect love completely casts out fear. When you actively operate in the unconditional love of Christ, every deep-seated fear of tomorrow, rejection, or failure is entirely eradicated from your heart. You are resting secure in the reality that your Heavenly Father deeply cares for you and protects you. Love is the most powerful spiritual force in the universe; it breaks down hardened walls, heals broken hearts, and guarantees final victory over every work of malice.",
            pointsEarned: 20,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
          },
        ],
      },
    },
  });

  // 4. Divine Speed & Purpose (5 Days) - Brand New Added Content
  await prisma.devotionPlan.create({
    data: {
      title: "Divine Speed & Purpose",
      description:
        "Break through limitations and experience the supernatural acceleration of God in your assignments.",
      image: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=800&q=80",
      durationDays: 5,
      authorName: "Apostle Joshua Selman",
      authorHandle: "@joshuaselman",
      tag: "Purpose & Growth",
      days: {
        create: [
          {
            dayNumber: 1,
            title: "The Blueprint of Purpose",
            bodyText:
              "Before you were formed in your mother's womb, God knew you, sanctified you, and ordained you for a specific purpose. True fulfillment in life cannot be found in material acquisition or public applause; it is found exclusively in discovering and executing the divine blueprint written concerning you in the books of heaven. Take time to strip away societal expectations and seek the Lord in prayer to clarify your specific calling and assignment for this season.",
            pointsEarned: 30,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 2,
            title: "Supernatural Acceleration",
            bodyText:
              "When the hand of the Lord comes upon a man, he is empowered to outrun the chariots of Ahab. Divine speed is not a product of frantic human hustle or manipulation; it is the supernatural consequence of the Holy Spirit backing your life. God can compress time and compress seasons, giving you results in a single month that normally take men a decade to achieve. Align your heart with His will and watch Him accelerate your progress.",
            pointsEarned: 30,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1493612276216-ee3925520721?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 3,
            title: "Eliminating Distractions",
            bodyText:
              'The enemy of great focus is not always bad things, but good things that have nothing to do with your current assignment. To experience true momentum and speed, you must learn to boldly say "No" to peripheral opportunities that drain your spiritual energy and time. Lay aside every weight and the sins that easily beset you, keeping your eyes completely fixed on the goal ahead. Streamline your routines, your circles, and your focus to match the magnitude of your vision.',
            pointsEarned: 30,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 4,
            title: "The Power of Divine Alignment",
            bodyText:
              "Connection determines direction. Who you walk with, listen to, and submit to will drastically alter the speed of your destiny. Walking in alignment means partnering with the right spiritual cover, cultivating relationships with destiny helpers, and maintaining a pure posture before God. When your character aligns with heaven's laws, structural blockages break away naturally, clearing a straight, highway-like path for your immediate elevation.",
            pointsEarned: 30,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=800&q=80",
          },
          {
            dayNumber: 5,
            title: "Sustaining Momentum",
            bodyText:
              "Reaching a peak is one thing, but staying there requires a completely different level of spiritual discipline. To sustain the momentum of divine speed, your secret place of prayer, word study, and worship must remain completely non-negotiable. Success must never breed complacency or pride in your heart. Stay small in your own eyes, continuously give all the glory back to the Father, and remain a teachable vessel ready for the next instruction.",
            pointsEarned: 30,
            videoUrl:
              "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4",
            image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
          },
        ],
      },
    },
  });

  console.log("Devotions seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
