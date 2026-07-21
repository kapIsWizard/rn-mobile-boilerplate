# Wzorce ochrony i szyfrowania danych mobilnych

Ten dokument definiuje domyślny model ochrony danych dla Expo/React Native. Nie zaczynamy od wyboru biblioteki. Zaczynamy od danych, przeciwnika, miejsca odszyfrowania i skutków utraty klucza.

## Zasady pierwszego rzędu

1. Najbezpieczniejsza dana to dana, której nie zbieramy lub nie utrwalamy.
2. Szyfrowanie, autoryzacja, minimalizacja i redakcja rozwiązują różne problemy. Żadne z nich nie zastępuje pozostałych.
3. Szyfrowanie dysku dostawcy chroni nośnik i backup, ale nie chroni plaintextu przed uprzywilejowanym procesem, operatorem bazy lub przejętym backendem.
4. Klucz przechowywany obok ciphertextu i dostępny z tymi samymi uprawnieniami nie tworzy istotnej nowej granicy bezpieczeństwa.
5. Hasła uwierzytelniające są haszowane przez sprawdzony system Auth/KDF, nigdy szyfrowane odwracalnie.
6. Base64, obfuskacja i sam hash nie są szyfrowaniem.
7. Biometria może zezwalać na użycie klucza. Nie jest kluczem, backupem ani mechanizmem odzyskiwania.
8. Nie projektujemy własnych algorytmów ani protokołów. Używamy dojrzałej, wersyjnie zgodnej biblioteki i szyfrowania uwierzytelnionego.
9. Utrata klucza może oznaczać utratę danych. Recovery, rotacja i usuwanie muszą powstać przed pierwszym ciphertextem produkcyjnym.
10. Logi, crash reports, analytics, schowek, klawiatura, zrzuty ekranu, cache, backupy i pamięć procesu należą do modelu danych.

Punktem odniesienia jest OWASP MASVS: `MASVS-STORAGE`, `MASVS-CRYPTO` i `MASVS-NETWORK`. Każda implementacja kryptografii wymaga świeżego rekordu źródeł dla wersji Expo/RN, platform i biblioteki.

## Najpierw klasyfikacja

| Klasa | Przykłady | Domyślna decyzja |
|---|---|---|
| `public` | feature flags bez sekretów, publiczny profil | integralność i TLS; brak dodatkowego szyfrowania aplikacyjnego |
| `internal` | nieszkodliwe preferencje, stan UI | sandbox aplikacji; wykluczenie z logów według potrzeby |
| `confidential` | prywatne notatki, adres, historia biznesowa | minimalizacja, RLS/autoryzacja, TLS, kontrola cache/backup; jawna decyzja o szyfrowaniu aplikacyjnym |
| `restricted` | dane medyczne, finansowe, dokumenty, sekrety klienta | profil krytyczny, jawny threat model, kontrolowany klucz, recovery i dowody negatywne |
| `credential` | token sesji, refresh token, klucz prywatny urządzenia | wyłącznie magazyn systemowy lub dedykowany vault; nigdy AsyncStorage ani bundle |

Kontrakt musi zinwentaryzować dla każdego pola: źródło, odbiorców, miejsca plaintextu, retencję, backup, logowanie, potrzebę wyszukiwania, tryb offline, eksport/usunięcie i wymogi prawne.

## Wybór profilu

### P0 — minimalizacja + ochrona platformy

Stosuj, gdy threat model nie wymaga ukrycia danych przed uprzywilejowanym backendem lub operatorem dostawcy.

- TLS w tranzycie, szyfrowanie nośników/backupu dostawcy, RLS i najmniejsze uprawnienia.
- Brak niepotrzebnego cache plaintextu na urządzeniu.
- Redakcja logów, crash reports, analytics, zrzutów i dowodów.
- W kontrakcie jawnie zapisz, kto nadal może odczytać dane.

To jest rozsądny baseline, ale nie jest field-level encryption ani E2EE.

### P1 — lokalny magazyn sekretów

Stosuj dla małych sekretów i materiału opakowującego klucze.

- Expo: dobierz `expo-secure-store` do zainstalowanego SDK przez `expo install` i zweryfikuj config plugin.
- iOS: Keychain, odpowiednia dostępność wpisu i decyzja, czy wpis może migrować lub przetrwać reinstalację.
- Android: magazyn zaszyfrowany z kluczem w Android Keystore; wyklucz nieodtwarzalne wpisy z Auto Backup.
- Nie przechowuj w SecureStore dużych payloadów ani jedynej kopii nieodtwarzalnych danych.
- `requireAuthentication` wymaga ścieżki dla zmiany biometrii, braku biometrii, anulowania i prawdziwego urządzenia.

SecureStore jest magazynem klucz-wartość, nie bazą zaszyfrowanych dokumentów. Dla większych danych użyj losowego DEK i szyfruj payload w sprawdzonej bibliotece; magazyn systemowy chroni jedynie klucz opakowujący lub wrapped DEK.

### P2 — szyfrowanie kopertowe po stronie backendu

Stosuj, gdy baza, dump lub backup nie powinny zawierać plaintextu, ale zaufany backend może odszyfrować dane.

1. Zaufany backend generuje losowy DEK przez CSPRNG.
2. Payload jest szyfrowany AEAD, domyślnie `AES-256-GCM`, z unikalnym nonce dla danego klucza.
3. Stabilne metadane rekordu, tenant i wersja formatu są uwierzytelnione jako AAD.
4. DEK jest opakowany przez KEK przechowywany w KMS/HSM poza bazą.
5. Baza przechowuje ciphertext, tag, nonce, wrapped DEK, identyfikator/wersję KEK i wersję formatu — nigdy plaintext DEK.
6. Plaintext istnieje wyłącznie w zaufanym procesie i jest usuwany z pamięci tak szybko, jak pozwala runtime.

Ten profil zwykle wyklucza bezpośredni zapis chronionych pól z mobilnego klienta do tabeli. Wymaga kontrolowanej funkcji/serwisu oraz nadal wymaga autoryzacji i RLS.

Przykładowa koperta logiczna:

```json
{
  "format": "mobilka.aead.v1",
  "algorithm": "AES-256-GCM",
  "keyId": "metadata-only",
  "keyVersion": 3,
  "nonce": "base64",
  "ciphertext": "base64",
  "tag": "base64",
  "wrappedDek": "base64",
  "aadSchema": "tenant+record+field+format"
}
```

Nie implementuj tego formatu ręcznie, jeżeli wybrany SDK/encryption SDK dostarcza własny wersjonowany format.

### P3 — szyfrowanie po stronie klienta / E2EE

Stosuj tylko wtedy, gdy backend i administratorzy usługi nie mogą znać plaintextu.

- Payload jest szyfrowany przed wysłaniem; serwer widzi ciphertext i minimalne metadane.
- Klucze użytkownika/urządzenia są opakowane kluczem sprzętowym, kluczem odzyskiwania lub protokołem wielourządzeniowym.
- Przed implementacją rozstrzygnij: nowe urządzenie, utracone urządzenie, reinstalacja, zmiana hasła i biometrii, współdzielenie, cofnięcie dostępu, eksport, śmierć konta, wsparcie i migracja algorytmu.
- Serwerowe wyszukiwanie, moderacja, deduplikacja, podglądy i powiadomienia mogą przestać działać albo wymagać świadomego wycieku metadanych.
- „Reset hasła odszyfruje dane” jest fałszywą obietnicą bez osobno zaprojektowanego recovery/escrow.

E2EE jest zmianą produktu i operacji, nie checkboxem biblioteki. Zawsze wymusza ryzyko `critical` i H1.

### P4 — hybryda

Łącz profile per pole i przepływ, nie per ekran. Przykład: publiczny tytuł do powiadomień, zaszyfrowana treść, token sesji w SecureStore, załącznik z osobnym DEK. Każdy jawny element metadanych musi być nazwany i zaakceptowany.

## Szyfrowanie szczególnych powierzchni

- Załączniki: osobny klucz per plik, streaming/chunked AEAD, uwierzytelnione metadane, kontrolowana miniatura i bezpieczne pliki tymczasowe.
- Wyszukiwanie: preferuj wyszukiwanie po odszyfrowaniu po stronie zaufanej. Deterministyczne szyfrowanie ujawnia równość i częstotliwość. Blind index/HMAC wymaga oddzielnego klucza, domeny i zaakceptowanego wycieku.
- Offline: szyfruj lokalną bazę/pliki, chroń klucz platformowo, definiuj politykę lock/logout/reinstall i usuwaj plaintextowe pliki tymczasowe.
- Backupi: opisz, czy klucz migruje. Backup ciphertextu bez odzyskiwalnego klucza jest nieprzydatny; backup klucza w tej samej granicy może niweczyć ochronę.
- Transport: TLS jest obowiązkowy. Certificate pinning jest decyzją risk-based z planem rotacji i awarii, nie domyślnym checkboxem.
- Supabase Vault: nadaje się do sekretów używanych wewnątrz Postgresa. Odszyfrowany widok jest czytelny dla uprawnionych ról, więc nie stanowi E2EE ani automatycznego rozwiązania dla prywatnych pól użytkownika.

## Cykl życia klucza

Każdy klucz ma klasę (`DEK`, `KEK`, urządzeniowy, recovery, signing), właściciela, granicę zaufania, algorytm, wersję, stan i cryptoperiod. Kontrakt określa:

- generowanie przez CSPRNG lub KMS, bez kluczy pochodzących ze stałych/predykowalnych danych;
- minimalne uprawnienia, zakaz eksportu KEK, audyt użycia i rozdzielenie środowisk/tenantów;
- rotację planową i natychmiastową po incydencie;
- `rewrap` DEK po rotacji KEK lub pełne odszyfrowanie/re-encryption, zależnie od modelu;
- odczyt starszych wersji w ograniczonym okresie migracji;
- revocation, crypto-shredding, retencję backupów i bezpieczne wycofanie;
- recovery/escrow oraz osoby uprawnione do uruchomienia procedury;
- telemetrykę metadanych bez kluczy, plaintextu, nonce/ciphertext par służących jako testowe sekrety produkcyjne.

Surowy klucz nie może pojawić się w repozytorium, promptach, MCP, logach, screenshotach, nagraniach, dowodach ani manifestach. Agenci mogą odczytać wyłącznie metadane: alias/ID, wersję, właściciela, status, politykę, publiczny fingerprint i informację o exportability.

## Obowiązkowy kontrakt przed H1

Każdy feature dotykający `confidential`, `restricted` lub `credential` tworzy `data-protection-contract.json` zgodny ze schematem `.agentic/schemas/data-protection-contract.schema.json`. Kontrakt jest częścią hashowanego pakietu specyfikacji i zawiera:

- klasyfikację i mapę plaintextu;
- przeciwników oraz jawnie niechronione granice;
- wybrany profil P0–P4 i odrzucone alternatywy;
- algorytm/bibliotekę lub deklarację `platform-managed`;
- hierarchię i cykl życia kluczy;
- zachowanie iOS/Android, backup, reinstalację i biometrię;
- wymagane oracles oraz ryzyka rezydualne;
- pytanie do człowieka, które H1 ma rozstrzygnąć.

Brak decyzji ma status `blocked`; agent nie może oznaczyć kontraktu jako zatwierdzony. Zatwierdzenie istnieje wyłącznie jako H1 związane digestem całego pakietu.

## Minimalne dowody

- statyczny skan kluczy, sekretów, niebezpiecznych trybów i plaintextowych sinków;
- test vectors oraz round-trip dla wersji formatu;
- odrzucenie zmienionego ciphertextu, tagu, AAD, złego klucza i nieobsługiwanej wersji;
- dowód unikalności nonce w zakresie klucza i równoległych zapisów;
- test rotacji/rewrap, przerwanej migracji, rollbacku i odczytu starej wersji;
- kontrola danych aplikacji, cache, plików, logów, crash/analytics, schowka i backupu;
- iOS i Android: cold start, background/lock, logout, reinstalacja, zmiana biometrii i brak biometrii według kontraktu;
- backend oracle potwierdzający, że chronione pole i backup nie zawierają znanego markera plaintextu;
- test cross-user/tenant nadal potwierdzający autoryzację niezależnie od szyfrowania;
- manualny recovery drill i incydent rotacji dla profilu krytycznego.

Agent-device może sterować natywnym zachowaniem i zebrać artefakty, ale bezpieczeństwo kryptograficzne wymaga także statycznych, integracyjnych i backendowych oracles. Sam screenshot nigdy nie dowodzi szyfrowania.

## Blokujące antywzorce

- stały/hardcoded klucz, klucz w `EXPO_PUBLIC_*`, bundle, repo lub AsyncStorage;
- ten sam klucz/nonce dla dwóch wiadomości AEAD;
- AES-ECB, szyfrowanie bez integralności, własny cipher lub ręczne składanie prymitywów bez review;
- wspólny klucz dla development, E2E, preview i production;
- logowanie plaintextu, kluczy lub pełnych tokenów;
- automatyczna aktualizacja crypto-baseline po błędzie testu;
- deterministyczne szyfrowanie „dla wyszukiwania” bez zaakceptowanego leakage model;
- usuwanie jedynego klucza przed potwierdzonym zakończeniem migracji;
- deklarowanie E2EE, gdy backend lub operator może uzyskać klucz/plaintext;
- zastępowanie RLS/autoryzacji szyfrowaniem.

## Oficjalne źródła i świeżość

Zweryfikowano 2026-07-22:

- OWASP MASVS i MASTG: <https://mas.owasp.org/MASVS/>
- OWASP Cryptographic Storage: <https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html>
- OWASP Key Management: <https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html>
- NIST SP 800-38D (GCM/GMAC; publikacja jest w rewizji): <https://csrc.nist.gov/pubs/sp/800/38/d/final>
- Expo SecureStore, dokumentacja SDK 55 odczytana jako bieżąca: <https://docs.expo.dev/versions/v55.0.0/sdk/securestore/>
- Android Keystore: <https://developer.android.com/privacy-and-security/keystore>
- Apple Keychain Services: <https://developer.apple.com/documentation/security/keychain-services>
- Apple Secure Enclave: <https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave>
- Google Cloud KMS envelope encryption jako neutralny wzorzec DEK/KEK: <https://docs.cloud.google.com/kms/docs/envelope-encryption>
- Supabase Vault: <https://supabase.com/docs/guides/database/vault>

Przed implementacją należy odświeżyć dokładne API, wersję biblioteki, ograniczenia platform i wymagania export compliance. Ten dokument nie pinujący biblioteki nie jest zgodą na użycie modelowej pamięci.
