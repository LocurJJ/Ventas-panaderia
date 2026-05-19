const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function dbPath(key) {
  return "panaderia_josue/" + key;
}

function saveOnline(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return db.ref(dbPath(key)).set(value);
}

function listenOnline(key, callback) {
  db.ref(dbPath(key)).on("value", snapshot => {
    const value = snapshot.val();

    if (Array.isArray(value)) {
      localStorage.setItem(key, JSON.stringify(value));
      callback(value);
    }
  });
}
