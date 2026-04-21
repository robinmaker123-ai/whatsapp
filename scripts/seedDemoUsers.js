const { connectDB, disconnectDB } = require("../src/config/db");
const User = require("../src/models/User");

const demoUsers = [
  {
    name: "User A",
    phone: "+919111111111",
    profilePic: "",
  },
  {
    name: "User B",
    phone: "+919222222222",
    profilePic: "",
  },
];

const seedDemoUsers = async () => {
  await connectDB();

  try {
    const results = await Promise.all(
      demoUsers.map((demoUser) =>
        User.findOneAndUpdate(
          { phone: demoUser.phone },
          {
            ...demoUser,
            status: "offline",
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          }
        )
      )
    );

    console.log("Demo users are ready:");
    results.forEach((userDoc) => {
      console.log(`- ${userDoc.name}: ${userDoc.phone}`);
    });
  } finally {
    await disconnectDB();
  }
};

seedDemoUsers()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Failed to seed demo users:", error.message);
    await disconnectDB();
    process.exit(1);
  });
