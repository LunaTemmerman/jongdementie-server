import express from "express";
import {createServer} from "http";
import {Server} from "socket.io";
// import {useAzureSocketIO} from "@azure/web-pubsub-socket.io";

import {
  makeId,
  getRoomIndex,
  findRoom,
  writeBatchToFirestore,
} from "./helpers.js";
import {initializeApp} from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  getDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBVZ1wJJvYRDLt30A8R_NDyKAsExUjz-as",
  authDomain: "jongdementie-mobile.firebaseapp.com",
  projectId: "jongdementie-mobile",
  storageBucket: "jongdementie-mobile.appspot.com",
  messagingSenderId: "935504245196",
  appId: "1:935504245196:web:5269f69066b283d56fed69",
};

const fbapp = initializeApp(firebaseConfig);
export const db = getFirestore(fbapp);
const datapointsBatchSize = 300;
export const datapointMaps = [];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:8081",
    methods: ["GET", "POST"],
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: Infinity,
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
      clients: [socket.id],
    };
    active_rooms.push(room);
    console.log("created room: " + room_id);
    io.to(room_id).emit("room:create", room_id);
  });
  socket.on("room:join", (room_id) => {
    if (!findRoom(active_rooms, room_id)) {
      io.to(socket.id).emit("room:join", new Error("Room not found"));
    } else {
      findRoom(active_rooms, room_id).clients.push(socket.id);
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
    try {
      if (!datapointMaps[room_id]) {
        datapointMaps[room_id] = [];
      }
      datapointMaps[room_id].push({
        data,
        created_at: `${new Date().toLocaleTimeString()} ${new Date().toLocaleDateString()}`,
      });

      // If batch size is reached, write to Firestore
      if (datapointMaps[room_id].length >= datapointsBatchSize) {
        await writeBatchToFirestore(room_id);
        datapointMaps[room_id] = [];
      }
    } catch (error) {
      console.error("Error handling received datapoints: ", error);
    }
  });
  socket.on("stress:detect", async (room_id) => {
    try {
      console.log("detected stress: " + room_id);
      io.to(room_id).emit("stress:detected");

      const docRef = doc(collection(db, "detections"), room_id);
      const docSnap = await getDoc(docRef);

      const timestamp = `${new Date().toLocaleTimeString()} ${new Date().toLocaleDateString()}`;

      if (!docSnap.exists()) {
        // Create the document if it does not exist
        await setDoc(docRef, {
          room_id: room_id,
          created_at: timestamp,
          detections: [timestamp],
        });
      } else {
        // Update the document if it exists
        await updateDoc(docRef, {
          detections: arrayUnion(timestamp),
        });
      }
      console.log(
        `document created or updated with room_id (stress-detected): ${room_id}`
      );
    } catch (error) {
      console.error("Error adding or updating document: ", error);
    }
  });
  socket.on("disconnect", (reason) => {
    console.log(socket.id + " is disconnected beacause " + reason);
    for (const room of active_rooms) {
      const clientIndex = room.clients.indexOf(socket.id);
      if (clientIndex !== -1) {
        room.clients.splice(clientIndex, 1);
        io.to(room.id).emit("client:disconnect");
        if (room.clients.length === 0) {
          const roomIndex = active_rooms.indexOf(room);
          if (roomIndex !== -1) {
            active_rooms.splice(roomIndex, 1);
          }
        }
        break;
      }
    }
  });
};

io.on("connection", onConnection);

httpServer.listen(2000, function () {
  return "<h1>Welcome</h1>";
});
