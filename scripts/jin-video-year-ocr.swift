// Local calendar OCR helper. Compile with swiftc, then pass crop PNG paths.
// macOS Vision may need the native service outside a restricted sandbox.
import Foundation
import Vision
import AppKit
let fm = FileManager.default
let files = CommandLine.arguments.dropFirst()
for path in files {
  guard let img = NSImage(contentsOfFile:path), let cg = img.cgImage(forProposedRect:nil, context:nil, hints:nil) else { continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["en-US", "zh-Hans"]
  req.usesLanguageCorrection = false
  req.usesCPUOnly = true
  do {
    try VNImageRequestHandler(cgImage:cg).perform([req])
    let strings = (req.results ?? []).compactMap { $0.topCandidates(1).first }.map { ["text": $0.string, "confidence":String($0.confidence)] }
    let row:[String:Any] = ["path":path,"ocr":strings]
    if let data=try? JSONSerialization.data(withJSONObject:row,options:[.sortedKeys]), let str=String(data:data,encoding:.utf8) { print(str) }
  } catch {
    let row:[String:Any] = ["path":path,"error":String(describing:error)]
    if let data=try? JSONSerialization.data(withJSONObject:row,options:[.sortedKeys]), let str=String(data:data,encoding:.utf8) { print(str) }
  }
}
