package com.vakit.widget

/**
 * Günün Esması widget'ının hangi ismi göstereceğini seçen saf fonksiyon.
 * android importu yok, JVM'de test edilir (bkz. EsmaDailyTest). Liste JS
 * tarafında (src/utils/esmaDaily.ts) da aynı dayOfYear % count kuralıyla
 * hesaplanır — burası yalnızca native tarafın kendi aritmetiğidir, JS'ten
 * bir seçim gelmez (widget uygulama hiç açılmasa da gece yarısı değişmeli).
 */
internal fun esmaIndexFor(dayOfYear: Int, count: Int): Int {
    if (count <= 0 || dayOfYear < 0) return 0
    return dayOfYear % count
}
