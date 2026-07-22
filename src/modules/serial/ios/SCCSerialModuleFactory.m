#import "valdi_core/SCValdiModuleFactoryRegistry.h"
#import <SerialTypes/SerialTypes.h>
#import <valdi_core/SCValdiPromise.h>
#import <Foundation/Foundation.h>

@interface SCCSerialModule: NSObject<SerialNativeModule>

@end

// USB-serial (CDC-ACM style, e.g. the FTDI/CH340/Arduino chips AYAB controllers use)
// has no public iOS API. Unlike Android's USB host mode, Apple restricts USB accessory
// communication to MFi-certified peripherals via the External Accessory framework — a
// generic USB-serial adapter can never be MFi-certified for this, so there is no way to
// implement this on iOS without different, MFi-certified hardware. This is a permanent
// platform limitation, not a pending TODO: connect over macOS, Android, or a browser
// with Web Serial support, or over the network if the controller supports Wi-Fi.
NSString *const SCCSerialNotSupportedExceptionName = @"SCCSerialNotSupportedOnIOS";
NSString *const SCCSerialNotSupportedReason =
    @"Serial (USB) connections are not supported on iOS. Apple restricts USB accessory "
     "communication to MFi-certified peripherals via the External Accessory framework and "
     "does not expose a generic USB-serial (CDC-ACM) API like Android's USB host mode, so "
     "this cannot be implemented for standard AYAB USB-serial adapters. Use macOS, Android, "
     "or a browser with Web Serial support instead.";

@implementation SCCSerialModule

- (void)close_serial
{
    // Nothing is ever open on iOS — no-op, matching how the other platforms
    // treat close_serial() as a no-op when there is no active connection.
}

- (void)open_serialWithUri:(NSString*)uri
{
    @throw [NSException exceptionWithName:SCCSerialNotSupportedExceptionName
                                    reason:SCCSerialNotSupportedReason
                                  userInfo:nil];
}

- (void)writeWithData:(NSData*)data
{
    // Nothing is ever open on iOS — no-op.
}

- (NSData*)read
{
    return [[NSData alloc] init];
}

- (BOOL)is_open
{
    return NO;
}

- (NSInteger)in_waiting
{
    return 0;
}

- (void)flush
{
    // Nothing is ever open on iOS — no-op.
}

- (BOOL)requires_usb_permission_prompt
{
    // Irrelevant — open_serialWithUri: always throws on iOS, so no USB device
    // ever needs a consent prompt here.
    return NO;
}

- (NSString*)prompt_websocket_url
{
    return nil;
}

- (NSArray<NSString*>*)get_serial_ports
{
    // Nothing can ever be opened on iOS — no ports to list.
    return @[];
}

- (SCValdiPromise<NSString*>*)request_serial_port
{
    return [SCValdiPromise resolvedPromiseWithValue:nil];
}

- (SCValdiPromise<NSArray<NSString*>*>*)refresh_serial_ports
{
    return [SCValdiPromise resolvedPromiseWithValue:@[]];
}

- (NSArray*)browse_ayab_mdns
{
    // mDNS discovery of network-connected controllers is implemented on
    // macOS only; other platforms (including iOS) return no records.
    return @[];
}

- (void (^)(void))registerDataAvailableResolverWithResolver:(void (^)(void))resolver
{
    // Never invoked — no connection ever succeeds on iOS, so no data ever
    // arrives to resolve. Return a no-op unregister function.
    return ^{};
}

- (void)consumeReadBufferWithBytesToConsume:(double)bytesToConsume
{
    // Nothing is ever buffered on iOS — no-op.
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