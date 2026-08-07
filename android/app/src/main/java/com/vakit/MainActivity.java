package com.vakit;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.vakit.widget.WidgetBridgePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local eklenti (npm paketi değil) — Bridge başlatılmadan önce
        // kaydedilmeli (design-refresh-v3 Faz 23 Commit 4).
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
