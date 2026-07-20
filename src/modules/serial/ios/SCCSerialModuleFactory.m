#import "valdi_core/SCValdiModuleFactoryRegistry.h"
#import <SerialTypes/SerialTypes.h>
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