// macOS Bonjour helpers for _ayab._tcp discovery.
#import <Foundation/Foundation.h>
#include <arpa/inet.h>
#include "valdi_core/cpp/Utils/ValueUtils.hpp"
#include "valdi_core/cpp/Utils/StringBox.hpp"
#include "valdi_core/cpp/Utils/ValueArray.hpp"
#include "MdnsDiscoveryMacOS.h"
#include <vector>

using namespace Valdi;

@interface AyabMdnsBrowseDelegate : NSObject<NSNetServiceBrowserDelegate, NSNetServiceDelegate>
@property(nonatomic, strong) NSMutableArray<NSDictionary*>* records;
@property(nonatomic, strong) NSMutableSet<NSString*>* pending;
@property(nonatomic, assign) BOOL moreComing;
@property(nonatomic, strong) dispatch_semaphore_t done;
@end

@implementation AyabMdnsBrowseDelegate

- (instancetype)init {
    self = [super init];
    if (self) {
        _records = [NSMutableArray array];
        _pending = [NSMutableSet set];
        _done = dispatch_semaphore_create(0);
    }
    return self;
}

- (void)signalIfIdle {
    if (!self.moreComing && self.pending.count == 0) {
        dispatch_semaphore_signal(self.done);
    }
}

- (void)netServiceBrowser:(NSNetServiceBrowser*)browser
           didFindService:(NSNetService*)service
               moreComing:(BOOL)moreComing {
    (void)browser;
    self.moreComing = moreComing;
    service.delegate = self;
    [self.pending addObject:service.name];
    [service resolveWithTimeout:5.0];
}

- (void)netServiceBrowserDidStopSearch:(NSNetServiceBrowser*)browser {
    (void)browser;
    self.moreComing = NO;
    [self signalIfIdle];
}

- (void)netServiceBrowser:(NSNetServiceBrowser*)browser
             didNotSearch:(NSDictionary<NSString*, NSNumber*>*)errorDict {
    (void)browser;
    (void)errorDict;
    dispatch_semaphore_signal(self.done);
}

- (void)netService:(NSNetService*)sender didNotResolve:(NSDictionary*)errorDict {
    (void)errorDict;
    [self.pending removeObject:sender.name];
    [self signalIfIdle];
}

- (NSString*)txtValue:(NSDictionary<NSString*, NSData*>*)txt
                    key:(NSString*)key
               fallback:(NSString*)fallback {
    NSData* data = txt[key];
    if (data == nil) {
        return fallback;
    }
    NSString* value = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    return value != nil ? value : fallback;
}

- (void)netServiceDidResolveAddress:(NSNetService*)sender {
    NSString* host = sender.hostName ?: @"";
    if ([host hasSuffix:@"."]) {
        host = [host substringToIndex:host.length - 1];
    }

    NSString* address = host;
    for (NSData* addrData in sender.addresses) {
        if (addrData.length >= sizeof(struct sockaddr_in)) {
            const struct sockaddr_in* addr = (const struct sockaddr_in*)addrData.bytes;
            if (addr->sin_family == AF_INET) {
                char buffer[INET_ADDRSTRLEN];
                inet_ntop(AF_INET, &addr->sin_addr, buffer, sizeof(buffer));
                address = [NSString stringWithUTF8String:buffer];
                break;
            }
        }
    }

    NSData* txtData = [sender TXTRecordData];
    NSDictionary<NSString*, NSData*>* txt =
        txtData != nil ? [NSNetService dictionaryFromTXTRecordData:txtData] : @{};
    NSString* path = [self txtValue:txt key:@"path" fallback:@"/ws"];
    if (![path hasPrefix:@"/"]) {
        path = [@"/" stringByAppendingString:path];
    }
    NSString* boardId = [self txtValue:txt key:@"board_id" fallback:@"<Unknown>"];

    [self.records addObject:@{
        @"server": host,
        @"address": address,
        @"port": @(sender.port),
        @"path": path,
        @"boardId": boardId,
    }];
    [self.pending removeObject:sender.name];
    [self signalIfIdle];
}

- (NSArray<NSDictionary*>*)browseWithTimeout:(NSTimeInterval)timeoutSeconds {
    NSNetServiceBrowser* browser = [[NSNetServiceBrowser alloc] init];
    browser.delegate = self;
    [browser searchForServicesOfType:@"_ayab._tcp." inDomain:@"local."];

    dispatch_time_t deadline = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(timeoutSeconds * NSEC_PER_SEC));
    dispatch_semaphore_wait(self.done, deadline);
    [browser stop];
    return [self.records copy];
}

@end

namespace snap::valdi::serial {

static Valdi::Value recordToValue(NSDictionary* record) {
    NSString* server = record[@"server"];
    NSString* address = record[@"address"];
    NSString* path = record[@"path"];
    NSString* boardId = record[@"boardId"];
    return Valdi::Value()
        .setMapValue("server", Valdi::Value(StringBox::fromCString([server UTF8String])))
        .setMapValue("address", Valdi::Value(StringBox::fromCString([address UTF8String])))
        .setMapValue("port", Valdi::Value(static_cast<int32_t>([record[@"port"] integerValue])))
        .setMapValue("path", Valdi::Value(StringBox::fromCString([path UTF8String])))
        .setMapValue("boardId", Valdi::Value(StringBox::fromCString([boardId UTF8String])));
}

std::vector<Valdi::Value> browseAyabMdnsRecordsMacOS() {
    @autoreleasepool {
        AyabMdnsBrowseDelegate* delegate = [[AyabMdnsBrowseDelegate alloc] init];
        NSArray<NSDictionary*>* records = [delegate browseWithTimeout:2.0];
        std::vector<Valdi::Value> values;
        values.reserve(records.count);
        for (NSDictionary* record in records) {
            values.push_back(recordToValue(record));
        }
        return values;
    }
}

} // namespace snap::valdi::serial
