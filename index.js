import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://chat-app-frontend-navnihal-satputes-projects.vercel.app/",
    methods: ["GET", "POST"],
  },
});

// Secret for JWT
const JWT_SECRET = "your_jwt_secret";

// Fake in-memory user store
const users = {};       // socket.id => username
const usernames = {};   // username => socket.id
const userDB = {};      // email => { passwordHash, username }

io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("set_username", (username) => {
    users[socket.id] = username;
    usernames[username] = socket.id;
    io.emit("update_user_list", Object.values(users));
    socket.broadcast.emit("chat_message", { message: `${username} joined`, username: "System" });
    socket.emit("chat_message", { message: `Welcome ${username}!`, username: "System" });
  });

  socket.on("send_message", ({ message, username, to }) => {
    if (to) {
      const targetSocketId = usernames[to];
      if (targetSocketId) {
        socket.to(targetSocketId).emit("chat_message", { message: `(Private) ${message}`, username });
        socket.emit("chat_message", { message: `(Private to ${to}) ${message}`, username });
      }
    } else {
      io.emit("chat_message", { message, username });
    }
  });

  socket.on("disconnect", () => {
    const username = users[socket.id];
    if (username) {
      delete usernames[username];
      delete users[socket.id];
      io.emit("update_user_list", Object.values(users));
      socket.broadcast.emit("chat_message", { message: `${username} left`, username: "System" });
    }
  });
});

// Register
app.post("/register", async (req, res) => {
  const { email, password, username } = req.body;
  if (!email || !password || !username) return res.status(400).send("Missing fields");
  if (userDB[email]) return res.status(400).send("User already exists");

  const passwordHash = await bcrypt.hash(password, 10);
  userDB[email] = { passwordHash, username };
  return res.status(201).send("User registered");
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = userDB[email];
  if (!user) return res.status(400).send("User not found");

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) return res.status(401).send("Invalid password");

  const token = jwt.sign({ email, username: user.username }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token, username: user.username });
});

server.listen(3001, () => console.log("Server running on port 3001"));
