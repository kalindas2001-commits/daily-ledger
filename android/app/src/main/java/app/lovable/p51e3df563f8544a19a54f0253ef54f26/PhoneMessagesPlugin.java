package app.lovable.p51e3df563f8544a19a54f0253ef54f26;

import android.Manifest;
import android.database.Cursor;
import android.provider.Telephony;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "PhoneMessages", permissions = {
  @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS })
})
public class PhoneMessagesPlugin extends Plugin {
  private static final Pattern FINANCIAL = Pattern.compile("RWF|FRW|USD|EUR|momo|airtel|payment|wakiriye|wohereje|wishyuye", Pattern.CASE_INSENSITIVE);

  @Override @PluginMethod
  public void requestPermissions(PluginCall call) {
    requestPermissionForAlias("sms", call, "smsPermissionResult");
  }
  @PermissionCallback
  private void smsPermissionResult(PluginCall call) { super.checkPermissions(call); }

  @PluginMethod
  public void readMessages(PluginCall call) {
    if (getPermissionState("sms") != PermissionState.GRANTED) { call.reject("SMS permission is required", "SMS_DENIED"); return; }
    Long afterValue = call.getLong("after");
    String afterId = call.getString("afterId", "0");
    Integer requestedLimit = call.getInt("limit", 100);
    if (afterValue == null || afterValue <= 0 || !afterId.matches("\\d+") || requestedLimit == null || requestedLimit < 1 || requestedLimit > 100) {
      call.reject("Invalid SMS cursor"); return;
    }
    final long after = afterValue;
    final int limit = requestedLimit;
    getBridge().execute(() -> {
      JSArray messages = new JSArray();
      long lastDate = after;
      String lastId = afterId;
      int read = 0;
      boolean hasMore = false;
      try (Cursor cursor = getContext().getContentResolver().query(
        Telephony.Sms.Inbox.CONTENT_URI, new String[] { "_id", "address", "body", "date" },
        "(date > ?) OR (date = ? AND _id > ?)", new String[] { String.valueOf(after), String.valueOf(after), afterId }, "date ASC, _id ASC")) {
        if (cursor == null) { call.reject("SMS inbox unavailable"); return; }
        while (cursor.moveToNext()) {
          if (read >= limit) { hasMore = true; break; }
          read++;
          lastId = cursor.getString(0); lastDate = cursor.getLong(3);
          String sender = cursor.getString(1); String body = cursor.getString(2);
          // Filter on-device; never return unrelated conversations or truncate financial evidence.
          if (body == null || body.length() > 8000 || !FINANCIAL.matcher(body).find()) continue;
          JSObject sms = new JSObject();
          sms.put("id", lastId); sms.put("sender", sender == null ? "" : sender.substring(0, Math.min(200, sender.length())));
          sms.put("body", body); sms.put("receivedAt", lastDate); messages.put(sms);
        }
        JSObject checkpoint = new JSObject(); checkpoint.put("after", lastDate); checkpoint.put("afterId", lastId);
        JSObject result = new JSObject(); result.put("messages", messages); result.put("cursor", checkpoint); result.put("hasMore", hasMore);
        call.resolve(result);
      } catch (SecurityException error) { call.reject("SMS permission was revoked", "SMS_DENIED"); }
      catch (Exception error) { call.reject("Could not read the SMS inbox"); }
    });
  }
}