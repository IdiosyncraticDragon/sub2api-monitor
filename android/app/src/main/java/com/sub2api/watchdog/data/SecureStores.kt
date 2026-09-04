package com.sub2api.watchdog.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.sub2api.watchdog.core.Appearance
import com.sub2api.watchdog.core.ThemeKey
import com.sub2api.watchdog.core.WidgetPreferences
import com.sub2api.watchdog.core.WidgetStyle
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import android.util.Base64

private val Context.settingsDataStore by preferencesDataStore("watchdog_settings")

interface CredentialStore { suspend fun loadAccessToken(): String?; suspend fun saveAccessToken(token: String); suspend fun clear() }

class KeystoreCredentialStore(private val context: Context) : CredentialStore {
    private val tokenKey = stringPreferencesKey("encrypted_access_token")
    private val alias = "sub2api-watchdog-token-v1"
    override suspend fun loadAccessToken(): String? = context.settingsDataStore.data.map { it[tokenKey] }.first()?.let(::decrypt)
    override suspend fun saveAccessToken(token: String) { context.settingsDataStore.edit { it[tokenKey] = encrypt(token) } }
    override suspend fun clear() { context.settingsDataStore.edit { it.remove(tokenKey) } }
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    private fun encrypt(value: String): String { val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key()); return Base64.encodeToString(cipher.iv + cipher.doFinal(value.encodeToByteArray()), Base64.NO_WRAP) }
    private fun decrypt(value: String): String? = try { val payload = Base64.decode(value, Base64.NO_WRAP); val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, key(), javax.crypto.spec.GCMParameterSpec(128, payload.copyOfRange(0, 12))); cipher.doFinal(payload.copyOfRange(12, payload.size)).decodeToString() } catch (_: Exception) { null }
}

class PreferenceStore(private val context: Context) {
    private val origin = stringPreferencesKey("server_origin")
    private val theme = stringPreferencesKey("theme")
    private val appearance = stringPreferencesKey("appearance")
    private val widgetStyle = stringPreferencesKey("widget_style")
    val originFlow: Flow<String> = context.settingsDataStore.data.map { it[origin].orEmpty() }
    val widgetPreferences: Flow<WidgetPreferences> = context.settingsDataStore.data.map { prefs ->
        WidgetPreferences(ThemeKey.valueOf(prefs[theme] ?: ThemeKey.CLAY.name), Appearance.valueOf(prefs[appearance] ?: Appearance.SYSTEM.name), WidgetStyle.valueOf(prefs[widgetStyle] ?: WidgetStyle.RINGS.name))
    }
    suspend fun setOrigin(value: String) = context.settingsDataStore.edit { it[origin] = value }
    suspend fun setPreferences(value: WidgetPreferences) = context.settingsDataStore.edit { it[theme] = value.theme.name; it[appearance] = value.appearance.name; it[widgetStyle] = value.widgetStyle.name }
}
