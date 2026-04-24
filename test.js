import { initializeApp } from 'firebase/app';
import { getFirestore, getDocFromServer, doc } from 'firebase/firestore';
import config from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  console.log("Testing connection...");
  try {
    await getDocFromServer(doc(db, '_health', 'check'));
    console.log("SUCCESS!");
    process.exit(0);
  } catch (err) {
    console.log("ERROR:", err.code, err.message);
    process.exit(1);
  }
}
test();
