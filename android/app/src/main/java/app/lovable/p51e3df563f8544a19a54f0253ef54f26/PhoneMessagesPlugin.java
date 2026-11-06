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
  @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS })
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
  public void setCollection(PluginCall call) {
    boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
    String owner = call.getString("owner", "");
    if (enabled && (getPermissionState("sms") != PermissionState.GRANTED || !owner.matches("[a-fA-F0-9-]{36}"))) {
      call.reject("SMS permission and a signed-in owner are required"); return;
    }
    android.content.SharedPreferences settings = getContext().getSharedPreferences(SmsPendingStore.SETTINGS, android.content.Context.MODE_PRIVATE);
    String previous = settings.getString("owner", "");
    settings.edit().putBoolean("enabled", false).commit();
    try (SmsPendingStore store = new SmsPendingStore(getContext())) {
      if (!enabled || !owner.equals(previous)) store.clear();
    }
    settings.edit().putString("owner", enabled ? owner : "").putBoolean("enabled", enabled).commit();
    call.resolve();
  }

  @PluginMethod
  public void readPending(PluginCall call) {
    if (getPermissionState("sms") != PermissionState.GRANTED) { call.reject("SMS permission is required", "SMS_DENIED"); return; }
    String owner = call.getString("owner", "");
    android.content.SharedPreferences settings = getContext().getSharedPreferences(SmsPendingStore.SETTINGS, android.content.Context.MODE_PRIVATE);
    if (!settings.getBoolean("enabled", false) || !owner.equals(settings.getString("owner", null))) { call.reject("SMS collection is not enabled for this user"); return; }
    try (SmsPendingStore store = new SmsPendingStore(getContext())) {
      JSObject result = new JSObject(); result.put("messages", store.pending(owner)); call.resolve(result);
    } catch (Exception error) { call.reject("Could not read saved phone messages"); }
  }

  @PluginMethod
  public void acknowledge(PluginCall call) {
    String owner = call.getString("owner", ""); String id = call.getString("id", "");
    android.content.SharedPreferences settings = getContext().getSharedPreferences(SmsPendingStore.SETTINGS, android.content.Context.MODE_PRIVATE);
    if (!id.matches("\\d+") || !owner.equals(settings.getString("owner", null))) { call.reject("Invalid saved message"); return; }
    try (SmsPendingStore store = new SmsPendingStore(getContext())) { store.acknowledge(owner, id); call.resolve(); }
    catch (Exception error) { call.reject("Could not acknowledge saved message"); }
  }

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