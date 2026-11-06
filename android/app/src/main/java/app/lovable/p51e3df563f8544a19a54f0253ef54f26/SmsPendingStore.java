package app.lovable.p51e3df563f8544a19a54f0253ef54f26;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.util.regex.Pattern;

/** App-private evidence only. No session tokens, balances, or ledger writes. */
final class SmsPendingStore extends SQLiteOpenHelper {
  static final String SETTINGS = "cungacash_sms_collection";
  static final Pattern FINANCIAL = Pattern.compile("RWF|FRW|USD|EUR|momo|airtel|payment|wakiriye|wohereje|wishyuye", Pattern.CASE_INSENSITIVE);
  SmsPendingStore(Context context) { super(context, "sms_pending.db", null, 1); }
  @Override public void onCreate(SQLiteDatabase db) {
    db.execSQL("CREATE TABLE pending (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, received INTEGER NOT NULL, UNIQUE(owner,sender,body,received))");
  }
  @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}
  void enqueue(String owner, String sender, String body, long received) {
    if (owner == null || body == null || body.length() > 8000 || !FINANCIAL.matcher(body).find()) return;
    ContentValues values = new ContentValues();
    values.put("owner", owner); values.put("sender", sender == null ? "" : sender);
    values.put("body", body); values.put("received", received);
    getWritableDatabase().insertWithOnConflict("pending", null, values, SQLiteDatabase.CONFLICT_IGNORE);
    // Bound private evidence retention to seven days; foreground scanning remains the source of truth.
    getWritableDatabase().delete("pending", "received < ?", new String[]{String.valueOf(System.currentTimeMillis() - 7L * 86400000L)});
  }
  JSArray pending(String owner) {
    JSArray messages = new JSArray();
    try (Cursor cursor = getReadableDatabase().query("pending", new String[]{"id","sender","body","received"}, "owner = ?", new String[]{owner}, null, null, "received ASC, id ASC", "100")) {
      while (cursor.moveToNext()) {
        JSObject sms = new JSObject(); sms.put("id", cursor.getString(0));
        sms.put("sender", cursor.getString(1)); sms.put("body", cursor.getString(2)); sms.put("receivedAt", cursor.getLong(3)); messages.put(sms);
      }
    }
    return messages;
  }
  void acknowledge(String owner, String id) { getWritableDatabase().delete("pending", "owner = ? AND id = ?", new String[]{owner,id}); }
  void clear() { getWritableDatabase().delete("pending", null, null); }
}