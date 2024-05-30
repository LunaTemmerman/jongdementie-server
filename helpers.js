import {collection, doc, setDoc} from "firebase/firestore";
import {db} from ".";

export function makeId() {
  let id = "";
  const characters = "0123456789";
  for (let i = 0; i < 5; i++) {
    id += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return id;
}

export function findRoom(active_rooms, room_id) {
  return active_rooms.find((room) => room.id === room_id);
}

export function getRoomIndex(active_rooms, room_id) {
  return active_rooms.findIndex((room) => room.id === room_id);
}

export async function writeBatchToFirestore(room_id) {
  try {
    const docRef = doc(collection(db, "datapoints"), room_id);
    const batchFieldName = `batch_${Date.now()}`;
    const batchData = {
      [batchFieldName]: datapointMaps[room_id],
    };

    // Update the document, adding the new batch
    await setDoc(docRef, batchData, {merge: true});

    console.log(`Batch write completed for room_id: ${room_id}`);

    // Clear the collected datapoints after writing
    datapointMaps[room_id] = [];
  } catch (error) {
    console.error("Error adding or updating document: ", error);
  }
}
