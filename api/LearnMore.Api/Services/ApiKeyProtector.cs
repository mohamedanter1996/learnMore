using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;

namespace LearnMore.Api.Services;

/// <summary>
/// Encrypts the Anthropic key at rest with Windows DPAPI, scoped to the current user.
///
/// What this protects against: someone who gets a copy of the database file. What it does not
/// protect against: malware already running as you, which could simply ask DPAPI to decrypt it.
/// The Settings screen says exactly that rather than implying more.
///
/// The ciphertext is bound to the Windows profile, so a reinstall, a new profile or a copied
/// .mdf makes it undecryptable. That is expected, not exceptional — <see cref="TryUnprotect"/>
/// returns null and the app asks for the key again.
/// </summary>
[SupportedOSPlatform("windows")]
public static class ApiKeyProtector
{
    /// <summary>Extra entropy. Does not stop a targeted attacker; does stop a generic sweep that
    /// unprotects every DPAPI blob it can find.</summary>
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("LearnMore.Coach.v1");

    public static string Protect(string plaintext)
    {
        var bytes = ProtectedData.Protect(
            Encoding.UTF8.GetBytes(plaintext), Entropy, DataProtectionScope.CurrentUser);
        return Convert.ToBase64String(bytes);
    }

    public static string? TryUnprotect(string? protectedBase64)
    {
        if (string.IsNullOrWhiteSpace(protectedBase64)) return null;
        try
        {
            var bytes = ProtectedData.Unprotect(
                Convert.FromBase64String(protectedBase64), Entropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(bytes);
        }
        catch (Exception e) when (e is CryptographicException or FormatException)
        {
            return null; // wrong profile, or the row was copied from another machine
        }
    }

    /// <summary>What the UI shows instead of the key. Never enough to reconstruct it.</summary>
    public static string Hint(string key) =>
        key.Length <= 4 ? "••••" : $"••••{key[^4..]}";
}
