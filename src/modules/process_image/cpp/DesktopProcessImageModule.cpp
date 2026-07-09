#include "valdi_core/cpp/JavaScript/ModuleFactoryRegistry.hpp"
#include "valdi_core/cpp/Utils/ValueFunctionWithCallable.hpp"
#include "valdi_core/cpp/Utils/ValueArray.hpp"
#include "valdi_core/cpp/Utils/ValueTypedArray.hpp"
#include "valdi_core/cpp/Utils/URL.hpp"
#include "valdi_core/cpp/Utils/DiskUtils.hpp"
#include "valdi_core/cpp/Utils/PathUtils.hpp"
#include "valdi_core/cpp/Utils/Bytes.hpp"
#include "valdi/runtime/Runtime.hpp"
#include "valdi/runtime/Resources/AssetsManager.hpp"
#include "valdi/runtime/Resources/AssetKey.hpp"
#include "valdi_core/cpp/Resources/LoadedAsset.hpp"
#include "snap_drawing/cpp/Utils/Image.hpp"

#include <cstring>

using namespace Valdi;

namespace snap::valdi::process_image {

static Valdi::Value bytesViewToUint8Array(BytesView data) {
    auto bytes = Valdi::makeShared<Valdi::Bytes>();
    bytes->resize(data.size());
    if (data.size() > 0) {
        std::memcpy(bytes->data(), data.data(), data.size());
    }
    auto typedArray = Valdi::makeShared<Valdi::ValueTypedArray>(
        Valdi::TypedArrayType::Uint8Array, bytes);
    return Valdi::Value(typedArray);
}

static Valdi::Value readFileBytesFromPath(const StringBox& pathStr) {
    auto colonIndex = pathStr.indexOf(':');
    if (colonIndex) {
        // module:, data:, valdi-res:, etc. — not a raw filesystem read.
        return Valdi::Value::undefined();
    }

    URL url(pathStr);
    if (url.getScheme() == "valdi-res") {
        return Valdi::Value::undefined();
    }

    Path filePath(pathStr.toStringView());
    auto loadResult = DiskUtils::load(filePath);
    if (!loadResult) {
        return Valdi::Value::undefined();
    }
    return bytesViewToUint8Array(loadResult.value());
}

class DesktopProcessImageModule : public valdi_core::ModuleFactory {
public:
    DesktopProcessImageModule() = default;
    ~DesktopProcessImageModule() override = default;

    Valdi::StringBox getModulePath() final {
        return Valdi::StringBox::fromCString("process_image/src/ProcessImageNative");
    }

    Valdi::Value loadModule() final {        
        // Implement getBits function
        auto getBitsFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                if (callContext.getParametersSize() != 1) {
                    return Valdi::Value::undefined();
                }
                
                // Get the path argument
                auto pathValue = callContext.getParameter(0);
                if (!pathValue.isString()) {
                    return Valdi::Value::undefined();
                } 
                
                StringBox pathStr = pathValue.toStringBox();

                
                // pathStr is of the form "module:filename" or "valdi-res://module/path" or file path
                StringBox moduleName;
                StringBox resourcePath;
                bool isResourcePath = false;
                
                // First check for "module:filename" format (colon separator)
                auto colonIndex = pathStr.indexOf(':');
                if (colonIndex) {
                    auto pair = pathStr.split(colonIndex.value());
                    moduleName = pair.first.trimmed();
                    resourcePath = pair.second;
                    isResourcePath = true;
                } else {
                    // Check for "valdi-res://module/path" format
                    URL url(pathStr);
                    StringBox scheme = url.getScheme();
                    
                    if (scheme == "valdi-res") {
                        StringBox urlPath = url.getPath();
                        auto firstSlash = urlPath.indexOf('/');
                        if (firstSlash) {
                            moduleName = urlPath.substring(0, firstSlash.value());
                            resourcePath = urlPath.substring(firstSlash.value() + 1);
                            isResourcePath = true;
                        }
                    }
                }
                
                if (isResourcePath) {
                    std::cout << "isResourcePath: true" << std::endl;
                    // Get runtime to access ResourceManager and AssetsManager
                    auto runtime = Runtime::currentRuntime();
                    if (runtime != nullptr) {
                        std::cout << "runtime: found" << std::endl;
                        auto& resourceManager = runtime->getResourceManager();
                        auto bundle = resourceManager.getBundle(moduleName);
                        auto& assetsManager = resourceManager.getAssetsManager();
                        
                        // Sanitize resource path (replace - with _) as Valdi does
                        StringBox sanitizedPath = resourcePath.replacing('-', '_');
                        
                        // Try to get asset using AssetsManager (handles asset packages)
                        AssetKey assetKey(bundle, sanitizedPath);
                        auto asset = assetsManager->getAsset(assetKey);
                        
                        if (asset != nullptr) {
                            std::cout << "asset: found" << std::endl;
                            // Try to get resolved location and load from there
                            auto resolvedLocation = asset->getResolvedLocation();
                            if (resolvedLocation) {
                                // AssetLocation extends URL, so we can get the path directly
                                StringBox pathStr = resolvedLocation->getPath();
                                Path filePath(pathStr.toStringView());
                                auto loadResult = DiskUtils::load(filePath);
                                if (loadResult) {
                                    BytesView imageBytes = loadResult.value();
                                    // Decode the PNG image
                                    auto imageResult = snap::drawing::Image::make(imageBytes);
                                    if (imageResult) {
                                        auto image = imageResult.value();
                                        auto bitmap = image->getBitmap();
                                        if (bitmap != nullptr) {
                                            Valdi::BitmapInfo info = bitmap->getInfo();
                                            void* pixelData = bitmap->lockBytes();
                                            
                                            auto result = ValueArray::make(info.height);
                                            
                                            // Extract pixel colors based on color type
                                            // Account for rowBytes padding when accessing pixel data
                                            if (info.colorType == Valdi::ColorTypeRGBA8888) {
                                                uint8_t* pixelBytesData = static_cast<uint8_t*>(pixelData);
                                                for (int row = 0; row < info.height; ++row) {
                                                    auto rowArray = ValueArray::make(info.width);
                                                    for (int col = 0; col < info.width; ++col) {
                                                        // Calculate byte offset accounting for rowBytes
                                                        size_t byteOffset = row * info.rowBytes + col * 4;
                                                        uint32_t pixel = *reinterpret_cast<uint32_t*>(pixelBytesData + byteOffset);
                                                        
                                                        auto pixelBytes = Valdi::makeShared<Valdi::Bytes>();
                                                        pixelBytes->resize(4);
                                                        pixelBytes->data()[0] = (pixel >> 0) & 0xFF;  // R
                                                        pixelBytes->data()[1] = (pixel >> 8) & 0xFF;  // G
                                                        pixelBytes->data()[2] = (pixel >> 16) & 0xFF; // B
                                                        pixelBytes->data()[3] = (pixel >> 24) & 0xFF; // A
                                                        auto typedArray = Valdi::makeShared<Valdi::ValueTypedArray>(
                                                            Valdi::TypedArrayType::Uint8Array, pixelBytes);
                                                        (*rowArray)[col] = Valdi::Value(typedArray);
                                                    }
                                                    (*result)[row] = Valdi::Value(rowArray);
                                                }
                                            } else if (info.colorType == Valdi::ColorTypeBGRA8888) {
                                                uint8_t* pixelBytesData = static_cast<uint8_t*>(pixelData);
                                                for (int row = 0; row < info.height; ++row) {
                                                    auto rowArray = ValueArray::make(info.width);
                                                    for (int col = 0; col < info.width; ++col) {
                                                        // Calculate byte offset accounting for rowBytes
                                                        size_t byteOffset = row * info.rowBytes + col * 4;
                                                        uint32_t pixel = *reinterpret_cast<uint32_t*>(pixelBytesData + byteOffset);
                                                        
                                                        auto pixelBytes = Valdi::makeShared<Valdi::Bytes>();
                                                        pixelBytes->resize(4);
                                                        pixelBytes->data()[0] = (pixel >> 16) & 0xFF; // R (from B)
                                                        pixelBytes->data()[1] = (pixel >> 8) & 0xFF;  // G
                                                        pixelBytes->data()[2] = (pixel >> 0) & 0xFF;  // B (from R)
                                                        pixelBytes->data()[3] = (pixel >> 24) & 0xFF; // A
                                                        auto typedArray = Valdi::makeShared<Valdi::ValueTypedArray>(
                                                            Valdi::TypedArrayType::Uint8Array, pixelBytes);
                                                        (*rowArray)[col] = Valdi::Value(typedArray);
                                                    }
                                                    (*result)[row] = Valdi::Value(rowArray);
                                                }
                                            }
                                            
                                            bitmap->unlockBytes();
                                            return Valdi::Value(result);
                                        }
                                    }
                                }
                            }
                            
                            // Also try to get bytes directly from bundle entry as fallback
                            auto entryResult2 = bundle->getEntry(sanitizedPath);
                            if (!entryResult2) {
                                entryResult2 = bundle->getEntry(resourcePath);
                            }
                            if (entryResult2) {
                                BytesView imageBytes = entryResult2.value();
                                auto imageResult = snap::drawing::Image::make(imageBytes);
                                if (imageResult) {
                                    auto image = imageResult.value();
                                    auto bitmap = image->getBitmap();
                                    if (bitmap != nullptr) {
                                        Valdi::BitmapInfo info = bitmap->getInfo();
                                        void* pixelData = bitmap->lockBytes();
                                        
                                        auto result = ValueArray::make(info.height);
                                        
                                        // Account for rowBytes padding when accessing pixel data
                                        if (info.colorType == Valdi::ColorTypeRGBA8888) {
                                            uint8_t* pixelBytesData = static_cast<uint8_t*>(pixelData);
                                            for (int row = 0; row < info.height; ++row) {
                                                auto rowArray = ValueArray::make(info.width);
                                                for (int col = 0; col < info.width; ++col) {
                                                    // Calculate byte offset accounting for rowBytes
                                                    size_t byteOffset = row * info.rowBytes + col * 4;
                                                    uint32_t pixel = *reinterpret_cast<uint32_t*>(pixelBytesData + byteOffset);
                                                    
                                                    auto pixelBytes = Valdi::makeShared<Valdi::Bytes>();
                                                    pixelBytes->resize(4);
                                                    pixelBytes->data()[0] = (pixel >> 0) & 0xFF;  // R
                                                    pixelBytes->data()[1] = (pixel >> 8) & 0xFF;  // G
                                                    pixelBytes->data()[2] = (pixel >> 16) & 0xFF; // B
                                                    pixelBytes->data()[3] = (pixel >> 24) & 0xFF; // A
                                                    auto typedArray = Valdi::makeShared<Valdi::ValueTypedArray>(
                                                        Valdi::TypedArrayType::Uint8Array, pixelBytes);
                                                    (*rowArray)[col] = Valdi::Value(typedArray);
                                                }
                                                (*result)[row] = Valdi::Value(rowArray);
                                            }
                                        } else if (info.colorType == Valdi::ColorTypeBGRA8888) {
                                            uint8_t* pixelBytesData = static_cast<uint8_t*>(pixelData);
                                            for (int row = 0; row < info.height; ++row) {
                                                auto rowArray = ValueArray::make(info.width);
                                                for (int col = 0; col < info.width; ++col) {
                                                    // Calculate byte offset accounting for rowBytes
                                                    size_t byteOffset = row * info.rowBytes + col * 4;
                                                    uint32_t pixel = *reinterpret_cast<uint32_t*>(pixelBytesData + byteOffset);
                                                    
                                                    auto pixelBytes = Valdi::makeShared<Valdi::Bytes>();
                                                    pixelBytes->resize(4);
                                                    pixelBytes->data()[0] = (pixel >> 16) & 0xFF; // R (from B)
                                                    pixelBytes->data()[1] = (pixel >> 8) & 0xFF;  // G
                                                    pixelBytes->data()[2] = (pixel >> 0) & 0xFF;  // B (from R)
                                                    pixelBytes->data()[3] = (pixel >> 24) & 0xFF; // A
                                                    auto typedArray = Valdi::makeShared<Valdi::ValueTypedArray>(
                                                        Valdi::TypedArrayType::Uint8Array, pixelBytes);
                                                    (*rowArray)[col] = Valdi::Value(typedArray);
                                                }
                                                (*result)[row] = Valdi::Value(rowArray);
                                            }
                                        }
                                        
                                        bitmap->unlockBytes();
                                        return Valdi::Value(result);
                                    }
                                }
                            }
                        }
                    }
                    
                    // Return empty array if loading failed
                    auto result = ValueArray::make(0);
                    return Valdi::Value(result);
                } else {
                    // Try to load as file path
                    Path filePath(pathStr.toStringView());
                    auto loadResult = DiskUtils::load(filePath);
                    if (loadResult) {
                        BytesView imageBytes = loadResult.value();
                        // Decode the PNG image
                        auto imageResult = snap::drawing::Image::make(imageBytes);
                        if (imageResult) {
                            auto image = imageResult.value();
                            auto bitmap = image->getBitmap();
                            if (bitmap != nullptr) {
                                auto info = bitmap->getInfo();
                                void* pixelData = bitmap->lockBytes();
                                
                                // Create 2D array: rows (height) x columns (width)
                                auto result = ValueArray::make(info.height);
                                
                                // Extract pixel colors based on color type
                                // Account for rowBytes padding when accessing pixel data
                                if (info.colorType == Valdi::ColorTypeRGBA8888) {
                                    uint8_t* pixelBytesData = static_cast<uint8_t*>(pixelData);
                                    for (int row = 0; row < info.height; ++row) {
                                        // Create row array with width elements
                                        auto rowArray = ValueArray::make(info.width);
                                        for (int col = 0; col < info.width; ++col) {
                                            // Calculate byte offset accounting for rowBytes
                                            size_t byteOffset = row * info.rowBytes + col * 4;
                                            uint32_t pixel = *reinterpret_cast<uint32_t*>(pixelBytesData + byteOffset);
                                            
                                            // Return RGBA as Uint8Array [R, G, B, A]
                                            auto pixelBytes = Valdi::makeShared<Valdi::Bytes>();
                                            pixelBytes->resize(4);
                                            pixelBytes->data()[0] = (pixel >> 0) & 0xFF;  // R
                                            pixelBytes->data()[1] = (pixel >> 8) & 0xFF;  // G
                                            pixelBytes->data()[2] = (pixel >> 16) & 0xFF; // B
                                            pixelBytes->data()[3] = (pixel >> 24) & 0xFF; // A
                                            auto typedArray = Valdi::makeShared<Valdi::ValueTypedArray>(
                                                Valdi::TypedArrayType::Uint8Array, pixelBytes);
                                            (*rowArray)[col] = Valdi::Value(typedArray);
                                        }
                                        (*result)[row] = Valdi::Value(rowArray);
                                    }
                                } else if (info.colorType == Valdi::ColorTypeBGRA8888) {
                                    uint8_t* pixelBytesData = static_cast<uint8_t*>(pixelData);
                                    for (int row = 0; row < info.height; ++row) {
                                        // Create row array with width elements
                                        auto rowArray = ValueArray::make(info.width);
                                        for (int col = 0; col < info.width; ++col) {
                                            // Calculate byte offset accounting for rowBytes
                                            size_t byteOffset = row * info.rowBytes + col * 4;
                                            uint32_t pixel = *reinterpret_cast<uint32_t*>(pixelBytesData + byteOffset);
                                            
                                            // Return RGBA as Uint8Array [R, G, B, A] (convert from BGRA)
                                            auto pixelBytes = Valdi::makeShared<Valdi::Bytes>();
                                            pixelBytes->resize(4);
                                            pixelBytes->data()[0] = (pixel >> 16) & 0xFF; // R (from B)
                                            pixelBytes->data()[1] = (pixel >> 8) & 0xFF;  // G
                                            pixelBytes->data()[2] = (pixel >> 0) & 0xFF;  // B (from R)
                                            pixelBytes->data()[3] = (pixel >> 24) & 0xFF; // A
                                            auto typedArray = Valdi::makeShared<Valdi::ValueTypedArray>(
                                                Valdi::TypedArrayType::Uint8Array, pixelBytes);
                                            (*rowArray)[col] = Valdi::Value(typedArray);
                                        }
                                        (*result)[row] = Valdi::Value(rowArray);
                                    }
                                } else {
                                    // For other formats, return empty array
                                    bitmap->unlockBytes();
                                    auto result = ValueArray::make(0);
                                    return Valdi::Value(result);
                                }
                                
                                bitmap->unlockBytes();
                                return Valdi::Value(result);
                            }
                        }
                    }
                    
                    // Return empty array if loading failed
                    auto result = ValueArray::make(0);
                    return Valdi::Value(result);
                }
            }
        );
        
        auto readFileBytesFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                if (callContext.getParametersSize() != 1) {
                    return Valdi::Value::undefined();
                }

                auto pathValue = callContext.getParameter(0);
                if (!pathValue.isString()) {
                    return Valdi::Value::undefined();
                }

                return readFileBytesFromPath(pathValue.toStringBox());
            });

        Valdi::Value exports;
        exports.setMapValue("getBits", Valdi::Value(getBitsFunction));
        exports.setMapValue("readFileBytes", Valdi::Value(readFileBytesFunction));
        return exports;
    }
};

Valdi::RegisterModuleFactory kRegisterDesktopModule([]() { return std::make_shared<DesktopProcessImageModule>(); });

} // namespace snap::valdi::process_image

