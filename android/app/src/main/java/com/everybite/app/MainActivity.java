package com.everybite.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final String PREFS = "everybite";
    private static final String KEY_SERVER = "server_url";
    private static final String DEFAULT_SERVER = "http://192.168.5.88:3456";
    private static final int REQ_FILE_CHOOSER = 1001;

    private WebView webView;
    private SharedPreferences prefs;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) showErrorPage();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if ("app://retry".equals(url)) { loadApp(); return true; }
                if ("app://server".equals(url)) { showServerDialog(); return true; }
                return false;
            }
        });
        // WebView 默认不处理 <input type="file">，需要原生层调起系统相册
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                String[] accept = params != null ? params.getAcceptTypes() : null;
                intent.setType(accept != null && accept.length > 0 && !accept[0].isEmpty()
                        ? accept[0] : "image/*");
                try {
                    startActivityForResult(
                            Intent.createChooser(intent, "选择封面照片"), REQ_FILE_CHOOSER);
                } catch (Exception e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "无法打开相册", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
        setContentView(webView);

        String server = prefs.getString(KEY_SERVER, null);
        if (server == null) {
            showServerDialog(); // 首次启动先确认服务器地址
        } else {
            loadApp();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER && filePathCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                results = new Uri[]{ data.getData() }; // 单选即可，前端是单文件上传
            }
            // 取消或失败也必须回传 null，否则后续文件选择会卡死
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    private void loadApp() {
        String server = prefs.getString(KEY_SERVER, DEFAULT_SERVER);
        webView.loadUrl(server);
    }

    private void showServerDialog() {
        final EditText input = new EditText(this);
        input.setText(prefs.getString(KEY_SERVER, DEFAULT_SERVER));
        input.setSelection(input.getText().length());
        input.setSingleLine(true);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        input.setPadding(pad, pad / 2, pad, 0);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("服务器地址")
                .setMessage("电脑启动服务后终端里显示的「手机访问」地址")
                .setView(input)
                .setPositiveButton("保存并打开", (d, w) -> {
                    String url = input.getText().toString().trim();
                    if (url.isEmpty()) url = DEFAULT_SERVER;
                    if (!url.startsWith("http")) url = "http://" + url;
                    prefs.edit().putString(KEY_SERVER, url).apply();
                    loadApp();
                })
                .setNegativeButton("取消", null)
                .create();
        dialog.setCanceledOnTouchOutside(false);
        dialog.show();
        input.requestFocus();
        input.postDelayed(() -> {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) imm.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
        }, 200);
    }

    private void showErrorPage() {
        String html = "<!DOCTYPE html><html><head><meta charset='utf-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='font-family:sans-serif;background:#F4F2EC;color:#2B2B26;"
                + "display:flex;flex-direction:column;align-items:center;justify-content:center;"
                + "min-height:100vh;margin:0;text-align:center;padding:24px;box-sizing:border-box;'>"
                + "<div style='font-size:56px;margin-bottom:16px;'>&#x1F373;</div>"
                + "<div style='font-size:18px;font-weight:bold;margin-bottom:10px;'>连不上菜谱服务</div>"
                + "<div style='font-size:14px;color:#5A5A50;line-height:2;margin-bottom:28px;'>"
                + "请确认：<br>1. 电脑上的菜谱服务已启动（启动.bat）<br>2. 手机和电脑连着同一个 WiFi</div>"
                + "<a href='app://retry' style='background:#5F7050;color:#fff;text-decoration:none;"
                + "padding:13px 40px;border-radius:999px;font-size:15px;font-weight:bold;'>重 试</a>"
                + "<a href='app://server' style='color:#5F7050;margin-top:20px;font-size:14px;'>修改服务器地址</a>"
                + "</body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    // 长按返回键：修改服务器地址
    @Override
    public boolean onKeyLongPress(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            showServerDialog();
            return true;
        }
        return super.onKeyLongPress(keyCode, event);
    }

    // 短按返回键：WebView 可后退则后退，否则退出
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
