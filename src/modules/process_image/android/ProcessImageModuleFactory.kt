package com.snap.modules.process_image

import com.snapchat.client.valdi_core.ModuleFactory
import com.snap.valdi.modules.RegisterValdiModule
import com.snap.modules.process_image.ProcessImageModuleFactory
import com.snap.modules.process_image.ProcessImageModule

@RegisterValdiModule
class ProcessImageModuleFactoryImpl: ProcessImageModuleFactory() {

    override fun onLoadModule(): ProcessImageModule {
        return object: ProcessImageModule {
            override fun getBits(path: String): Array<ByteArray> {
                // TODO: Implement image processing to get bits
                // For now, return empty array
                return emptyArray()
            }
        }
    }
}