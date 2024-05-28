import {makeId, getRoomIndex, findRoom} from "./helpers.js";
import express from "express";
import {createServer} from "http";
import {Server} from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["*"],
    methods: ["GET", "POST"],
  },
});

const active_rooms = [];

const onConnection = (socket) => {
  console.log("connected to server: " + socket.id);
  socket.on("room:create", () => {
    let room_id = makeId();
    while (!(getRoomIndex(active_rooms, room_id) === -1)) {
      room_id = makeId();
    }
    socket.join(room_id);
    const room = {
      id: room_id,
    };
    active_rooms.push(room);
    console.log("created room: " + room_id);
    io.to(room_id).emit("room:create", room_id);
  });
  socket.on("room:join", (room_id) => {
    if (!findRoom(active_rooms, room_id)) {
      io.to(socket.id).emit("room:join", new Error("Room not found"));
    } else {
      socket.join(room_id);
      console.log("joine room: " + room_id);
      socket.emit(
        "room:join",
        active_rooms[getRoomIndex(active_rooms, room_id)]
      );
      io.to(room_id).emit("watch:connected");
    }
  });
  socket.on("stress:detect", (room_id) => {
    console.log("detected stress: " + room_id);
    io.to(room_id).emit("stress:detected");
  });
  socket.on("disconnect", () => {});
};

io.on("connection", onConnection);

app.get("/", (req, res) => {
  res.send("Hello visitor!");
});

httpServer.listen(4000);
