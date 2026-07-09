#import "valdi_core/SCValdiModuleFactoryRegistry.h"
#import <SerialTypes/SerialTypes.h>
#import <Foundation/Foundation.h>

@interface SCCSerialModule: NSObject<SerialNativeModule>

@end

@implementation SCCSerialModule

// TODO: Implement the actual serial communication methods
- (void)close_serial
{
    // Implementation needed
}

- (void)open_serialWithUri:(NSString*)uri
{
    // Implementation needed
}

- (void)writeWithData:(NSData*)data
{
    // Implementation needed
}

- (NSData*)read
{
    // Implementation needed
    return [[NSData alloc] init];
}

- (BOOL)is_open
{
    // Implementation needed
    return NO;
}

- (NSInteger)in_waiting
{
    // Implementation needed
    return 0;
}

- (void)flush
{
    // Implementation needed
}

@end

@interface SCCSerialModuleFactoryImpl : SerialNativeModuleFactory

@end

@implementation SCCSerialModuleFactoryImpl

VALDI_REGISTER_MODULE()

- (id<SerialNativeModule>)onLoadModule
{
    return [SCCSerialModule new];
}

@end