package app.lovable.p51e3df563f8544a19a54f0253ef54f26;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle savedInstanceState) {
    registerPlugin(PhoneMessagesPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
