/*
  esp32_crowd_node.ino
  Hybrid WiFi + BLE scanner -> POSTs JSON to local laptop

  Modify:
   - WIFI_SSID / WIFI_PASS: the WiFi network the ESP32 should join (also used to reach laptop)
   - SERVER_IP / SERVER_PORT / ENDPOINT
   - LOCATION: "Labs" / "Library" / "Canteen" per device

  Notes:
   - Uses esp_wifi scanning to gather BSSID (MAC) of nearby WiFi devices
   - Uses BLE scan to collect BLE device addresses
   - Combines unique IDs and sends counts + timestamp to server
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include "esp_wifi.h"
#include <BLEDevice.h>
#include <BLEScan.h>

/////////////////////////////////////
// Configuration - EDIT per device //
/////////////////////////////////////
const char* WIFI_SSID = "";
const char* WIFI_PASS = "";

const char* SERVER_IP = ""; // laptop IP on same network
const int   SERVER_PORT = 5000;
const char* ENDPOINT = "/post_data";

String LOCATION = "Canteen"; // change to "Library" or "Canteen" when flashing other nodes

const unsigned long SCAN_INTERVAL_MS = 15000; // how often to do a scan & send (ms)
const int WIFI_SCAN_DURATION = 5; // seconds
const int BLE_SCAN_DURATION = 5;  // seconds

/////////////////////////////////////

unsigned long lastScan = 0;

// helper: check if vector contains item
bool contains(const std::vector<String>& v, const String& s) {
  for (auto &x: v) if (x == s) return true;
  return false;
}

// WiFi scan using esp_wifi APIs to get BSSID (MAC)
std::vector<String> scanWiFiForMACs(int durationSec) {
  std::vector<String> macs;

  // Configure scan params and start
  wifi_scan_config_t scanConf = {0};
  scanConf.ssid = NULL;
  scanConf.bssid = NULL;
  scanConf.channel = 0;
  scanConf.show_hidden = true;
  scanConf.scan_type = WIFI_SCAN_TYPE_ACTIVE;
  scanConf.scan_time.active.min = durationSec * 100; // not precise, but ok
  scanConf.scan_time.active.max = durationSec * 100;

  esp_err_t err = esp_wifi_scan_start(&scanConf, true); // true => block until done
  if (err != ESP_OK) {
    Serial.printf("esp_wifi_scan_start failed: %d\n", err);
    return macs;
  }

  uint16_t apCount = 0;
  esp_wifi_scan_get_ap_num(&apCount);
  if (apCount == 0) return macs;

  wifi_ap_record_t *apRecords = (wifi_ap_record_t*)malloc(sizeof(wifi_ap_record_t) * apCount);
  if (!apRecords) {
    Serial.println("malloc failed");
    return macs;
  }

  if (esp_wifi_scan_get_ap_records(&apCount, apRecords) == ESP_OK) {
    for (int i = 0; i < apCount; ++i) {
      uint8_t* bssid = apRecords[i].bssid;
      char macStr[20];
      sprintf(macStr, "%02X:%02X:%02X:%02X:%02X:%02X",
              bssid[0], bssid[1], bssid[2], bssid[3], bssid[4], bssid[5]);
      String s = String(macStr);
      // avoid APs that are our access point? (optional)
      if (!contains(macs, s)) macs.push_back(s);
    }
  }

  free(apRecords);
  return macs;
}

// BLE scan using NimBLE/ESP32 BLE library
std::vector<String> scanBLEForMACs(int durationSec) {
  std::vector<String> macs;

  BLEDevice::init("");
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  // In newer libraries, start() returns BLEScanResults*
  BLEScanResults* results = pBLEScan->start(durationSec, false);
  int count = results->getCount();

  Serial.printf("Found %d BLE devices\n", count);
  for (int i = 0; i < count; i++) {
    BLEAdvertisedDevice adv = results->getDevice(i);
    String addr = adv.getAddress().toString().c_str();
    if (!contains(macs, addr)) macs.push_back(addr);
    Serial.println(addr);
  }

  pBLEScan->clearResults();
  return macs;
}

// combine lists and deduplicate
std::vector<String> combineUnique(const std::vector<String>& a, const std::vector<String>& b) {
  std::vector<String> result = a;
  for (auto &s: b) if (!contains(result, s)) result.push_back(s);
  return result;
}

// Build JSON and POST to server
void sendDataToServer(int wifiCount, int bleCount, int totalCount) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Not connected to WiFi - skipping POST");
    return;
  }

  unsigned long ts = millis() / 1000; // sec since boot; server can use its own timestamp too
  String json = "{";
  json += "\"location\":\"" + LOCATION + "\",";
  json += "\"timestamp\":" + String(ts) + ",";
  json += "\"wifi_count\":" + String(wifiCount) + ",";
  json += "\"ble_count\":" + String(bleCount) + ",";
  json += "\"total_count\":" + String(totalCount);
  json += "}";

  String url = String("http://") + SERVER_IP + ":" + String(SERVER_PORT) + ENDPOINT;
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST((uint8_t*)json.c_str(), json.length());
  if (httpResponseCode > 0) {
    String resp = http.getString();
    Serial.printf("POST %s -> %d : %s\n", url.c_str(), httpResponseCode, resp.c_str());
  } else {
    Serial.printf("POST failed, error: %d\n", httpResponseCode);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("ESP32 Crowd Node starting...");

  // Connect to WiFi (so device can POST to server)
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    Serial.print(".");
    delay(500);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.print("WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("");
    Serial.println("WiFi connect failed - still continuing (scans may work depending on AP)");
  }
  lastScan = millis() - SCAN_INTERVAL_MS; // trigger immediate scan
}

void loop() {
  if (millis() - lastScan < SCAN_INTERVAL_MS) return;
  lastScan = millis();

  Serial.println("Starting WiFi scan...");
  auto wifiMacs = scanWiFiForMACs(WIFI_SCAN_DURATION);
  Serial.printf("WiFi devices found: %d\n", (int)wifiMacs.size());

  Serial.println("Starting BLE scan...");
  auto bleMacs = scanBLEForMACs(BLE_SCAN_DURATION);
  Serial.printf("BLE devices found: %d\n", (int)bleMacs.size());

  auto uniqueAll = combineUnique(wifiMacs, bleMacs);
  int wifiCount = wifiMacs.size();
  int bleCount = bleMacs.size();
  int totalCount = uniqueAll.size();

  Serial.printf("Unique total devices (dedup): %d\n", totalCount);

  sendDataToServer(wifiCount, bleCount, totalCount);
}
