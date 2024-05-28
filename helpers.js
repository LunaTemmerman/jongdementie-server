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
