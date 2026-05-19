const firebaseConfig = {
  apiKey: "AIzaSyAl2gyZygEHklr5gq2WuDShwuW6GmSEKQ",
  authDomain: "panaderia-venta.firebaseapp.com",
  databaseURL: "https://panaderia-venta-default-rtdb.firebaseio.com",
  projectId: "panaderia-venta",
  storageBucket: "panaderia-venta.firebasestorage.app",
  messagingSenderId: "672040680513",
  appId: "1:672040680513:web:ed523e825a36749b325ac0"
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
  db.ref(dbPath(key)).on("value", (snapshot) => {
    const value = snapshot.val();

    if (Array.isArray(value)) {
      localStorage.setItem(key, JSON.stringify(value));
      callback(value);
    }
  });
}
