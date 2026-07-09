#import "valdi_core/SCValdiModuleFactoryRegistry.h"
#import "valdi_core/SCValdiImage.h"
#import <ProcessImageTypes/ProcessImageTypes.h>
#import <Foundation/Foundation.h>

@interface SCCProcessImageNativeModule: NSObject<ProcessImageNativeModule>

@end

@implementation SCCProcessImageNativeModule

// Reads the contents of the image file at path and returns an array of NSData objects, one for each bit of the image.
- (NSArray<NSData*>*)getBitsWithPath:(NSString*)path
{
    SCValdiImage *image = nil;
    
    // Check if this is a valdi-res:// URL
    NSURL *url = [NSURL URLWithString:path];
    if (url && [url.scheme isEqualToString:@"valdi-res"]) {
        NSString *moduleName = url.host;
        NSString *resourcePath = url.path;
        if ([resourcePath hasPrefix:@"/"]) {
            resourcePath = [resourcePath substringFromIndex:1];
        }
        image = [SCValdiImage imageWithModuleName:moduleName resourcePath:resourcePath];
    } else {
        // Try as file path
        image = [SCValdiImage imageWithFilePath:path error:nil];
    }
    
    if (!image) {
        return [NSArray new];
    }
    NSData *data = [image toPNG];
    if (!data) {
        return [NSArray new];
    }
    return @[data]; 
}

@end

@interface SCCProcessImageNativeModuleFactoryImpl : ProcessImageNativeModuleFactory

@end

@implementation SCCProcessImageNativeModuleFactoryImpl

VALDI_REGISTER_MODULE()

- (id<ProcessImageNativeModule>)onLoadModule
{
    return [SCCProcessImageNativeModule new];
}

@end