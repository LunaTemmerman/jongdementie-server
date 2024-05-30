import express from "express";
import {createServer} from "http";
import {Server} from "socket.io";
import {makeId, getRoomIndex, findRoom} from "./helpers.js";
import {initializeApp} from "firebase/app";
import {addDoc, collection, getFirestore} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBVZ1wJJvYRDLt30A8R_NDyKAsExUjz-as",
  authDomain: "jongdementie-mobile.firebaseapp.com",
  projectId: "jongdementie-mobile",
  storageBucket: "jongdementie-mobile.appspot.com",
  messagingSenderId: "935504245196",
  appId: "1:935504245196:web:5269f69066b283d56fed69",
};

// Initialize Firebase
const fbapp = initializeApp(firebaseConfig);
const db = getFirestore(fbapp);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 10 * 60 * 1000,
    skipMiddlewares: true,
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
      console.log("joined room: " + room_id);
      io.to(socket.id).emit(
        "room:join",
        active_rooms[getRoomIndex(active_rooms, room_id)]
      );
      io.to(room_id).emit("watch:connected");
    }
  });
  socket.on("datapoints:received", async (room_id, data) => {
    const docRef = await addDoc(collection(db, `datapoints}`), {
      room_id: room_id,
      created_at: `${new Date().toLocaleTimeString()} ${new Date().toLocaleDateString()}`,
      data,
    });
    console.log(`document created with id: ${docRef?.id}`);
  });
  socket.on("stress:detect", async (room_id) => {
    console.log("detected stress: " + room_id);
    io.to(room_id).emit("stress:detected");
    const docRef = await addDoc(`/detections`, {
      room_id,
      created_at: `${new Date().toLocaleTimeString()} ${new Date().toLocaleDateString()}`,
    });
    console.log(`document created with id: ${docRef?.id}`);
  });
  socket.on("disconnect", () => {});
};

io.on("connection", onConnection);

httpServer.listen(4000, function () {
  return "<h1>Welcome</h1>";
});
