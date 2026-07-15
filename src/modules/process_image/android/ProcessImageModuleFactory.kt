package com.snap.modules.process_image

import android.graphics.BitmapFactory
import com.snap.valdi.modules.RegisterValdiModule
import java.io.File

@RegisterValdiModule
class ProcessImageNativeModuleFactoryImpl : ProcessImageNativeModuleFactory() {

    override fun onLoadModule(): ProcessImageNativeModule {
        return object : ProcessImageNativeModule {
            // Rows of [R, G, B, A] pixel byte arrays, matching the desktop
            // impl (DesktopProcessImageModule.cpp) and web canvas layout.
            // Only filesystem paths (native file picker) land here: bundled
            // sample resources decode in TS via preview/ModuleResourceBits,
            // because Android R drawables are density-resampled.
            override fun getBits(path: String): List<List<ByteArray>> {
                val bitmap = BitmapFactory.decodeFile(path) ?: return emptyList()
                try {
                    val width = bitmap.width
                    val height = bitmap.height
                    val rowPixels = IntArray(width)
                    val rows = ArrayList<List<ByteArray>>(height)
                    for (y in 0 until height) {
                        bitmap.getPixels(rowPixels, 0, width, 0, y, width, 1)
                        val row = ArrayList<ByteArray>(width)
                        for (x in 0 until width) {
                            val argb = rowPixels[x]
                            row.add(
                                byteArrayOf(
                                    ((argb shr 16) and 0xFF).toByte(), // R
                                    ((argb shr 8) and 0xFF).toByte(), // G
                                    (argb and 0xFF).toByte(), // B
                                    ((argb shr 24) and 0xFF).toByte(), // A
                                )
                            )
                        }
                        rows.add(row)
                    }
                    return rows
                } finally {
                    bitmap.recycle()
                }
            }

            override fun readFileBytes(path: String): ByteArray {
                return File(path).readBytes()
            }
        }
    }
}
