// 用 macOS 自带的识别能力找人脸、找文字，结果以 JSON 打印出来。由 tools/measure.mjs 调用，一般不用直接跑。
//
//   vision face <图片>...          每张图里最大的那张脸
//   vision text <图片> [要找的字]   图上认出来的每一行字；给了要找的字，另外返回它在图上的位置（可能不止一处）
//   vision look <图片>...          最大那张脸的神态：看不看镜头、嘴张多大、嘴歪不歪、眼睛睁没睁、转头多少、画质分（挑封面帧用）
//
// 坐标都以左上角为原点：face 是 0..1 的比例，text 是像素。
import Foundation
import Vision
import ImageIO

func load(_ path: String) -> CGImage? {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else { return nil }
  return CGImageSourceCreateImageAtIndex(src, 0, nil)
}

func emit(_ obj: Any) {
  let data = try! JSONSerialization.data(withJSONObject: obj, options: [])
  print(String(data: data, encoding: .utf8)!)
}

func r4(_ v: CGFloat) -> Double { return (Double(v) * 10000).rounded() / 10000 }

func faces(_ paths: [String]) {
  var out: [[String: Any]] = []
  for p in paths {
    guard let img = load(p) else { out.append(["file": p, "error": "读不了这张图"]); continue }
    let req = VNDetectFaceRectanglesRequest()
    try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    let all = (req.results ?? []).sorted { $0.boundingBox.width * $0.boundingBox.height > $1.boundingBox.width * $1.boundingBox.height }
    if let f = all.first {
      let b = f.boundingBox
      out.append(["file": p, "count": all.count, "face": ["x": r4(b.midX), "y": r4(1 - b.midY), "w": r4(b.width), "h": r4(b.height)]])
    } else {
      out.append(["file": p, "count": 0])
    }
  }
  emit(out)
}

// 不分大小写、忽略空格地找：返回 needle 在这一行里每一处的范围
func ranges(of needle: String, in s: String) -> [Range<String.Index>] {
  var idx: [String.Index] = []
  var chars: [Character] = []
  for i in s.indices where !s[i].isWhitespace {
    for c in String(s[i]).lowercased() { chars.append(c); idx.append(i) }
  }
  let n = Array(needle.lowercased().filter { !$0.isWhitespace })
  var out: [Range<String.Index>] = []
  guard n.count > 0, chars.count >= n.count else { return out }
  var i = 0
  while i + n.count <= chars.count {
    if Array(chars[i..<(i + n.count)]) == n {
      out.append(idx[i]..<s.index(after: idx[i + n.count - 1]))
      i += n.count
    } else {
      i += 1
    }
  }
  return out
}

func text(_ path: String, _ needle: String?) {
  guard let img = load(path) else { emit(["error": "读不了这张图"]); return }
  let W = CGFloat(img.width), H = CGFloat(img.height)
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["zh-Hans", "en-US"]
  req.usesLanguageCorrection = false
  try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
  func px(_ b: CGRect) -> [Int] { return [Int((b.minX * W).rounded()), Int(((1 - b.maxY) * H).rounded()), Int((b.width * W).rounded()), Int((b.height * H).rounded())] }
  var lines: [[String: Any]] = []
  var hits: [[String: Any]] = []
  for ob in req.results ?? [] {
    guard let cand = ob.topCandidates(1).first else { continue }
    lines.append(["text": cand.string, "rect": px(ob.boundingBox)])
    if let n = needle {
      for r in ranges(of: n, in: cand.string) {
        if let box = try? cand.boundingBox(for: r) { hits.append(["rect": px(box.boundingBox), "line": cand.string]) }
      }
    }
  }
  // 从上到下、从左到右排，「第几处」才有意义
  let order: ([String: Any], [String: Any]) -> Bool = { a, b in
    let ra = a["rect"] as! [Int], rb = b["rect"] as! [Int]
    return abs(ra[1] - rb[1]) > 12 ? ra[1] < rb[1] : ra[0] < rb[0]
  }
  emit(["width": img.width, "height": img.height, "lines": lines.sorted(by: order), "hits": hits.sorted(by: order)])
}

// 挑封面帧用：量最大那张脸的神态。数字都是相对量，越接近 0 越「正」（open/quality 除外）
func look(_ paths: [String]) {
  var out: [[String: Any]] = []
  func pts(_ r: VNFaceLandmarkRegion2D?) -> [CGPoint] { return r.map { Array($0.normalizedPoints) } ?? [] }
  func center(_ p: [CGPoint]) -> CGPoint { let n = CGFloat(max(p.count, 1)); return CGPoint(x: p.reduce(0) { $0 + $1.x } / n, y: p.reduce(0) { $0 + $1.y } / n) }
  func span(_ p: [CGPoint]) -> (w: CGFloat, h: CGFloat) {
    guard let x0 = p.map({ $0.x }).min(), let x1 = p.map({ $0.x }).max(), let y0 = p.map({ $0.y }).min(), let y1 = p.map({ $0.y }).max() else { return (0, 0) }
    return (x1 - x0, y1 - y0)
  }
  for p in paths {
    guard let img = load(p) else { out.append(["file": p, "error": "读不了这张图"]); continue }
    let lm = VNDetectFaceLandmarksRequest()
    let q = VNDetectFaceCaptureQualityRequest()
    try? VNImageRequestHandler(cgImage: img, options: [:]).perform([lm, q])
    guard let f = (lm.results ?? []).max(by: { $0.boundingBox.width < $1.boundingBox.width }), let L = f.landmarks else { out.append(["file": p, "face": false]); continue }
    let le = pts(L.leftEye), re = pts(L.rightEye), lp = pts(L.leftPupil), rp = pts(L.rightPupil)
    let inner = pts(L.innerLips), outer = pts(L.outerLips)
    // 视线：瞳孔偏离眼眶中心多少（按眼眶宽度算），两只眼取平均
    var gaze: CGFloat = 1
    if le.count > 0, re.count > 0, lp.count > 0, rp.count > 0 {
      let gl = (center(lp).x - center(le).x) / max(span(le).w, 0.001), gr = (center(rp).x - center(re).x) / max(span(re).w, 0.001)
      let vl = (center(lp).y - center(le).y) / max(span(le).w, 0.001), vr = (center(rp).y - center(re).y) / max(span(re).w, 0.001)
      gaze = (abs(gl + gr) / 2) + (abs(vl + vr) / 2) * 0.5
    }
    let eyeOpen = (span(le).h / max(span(le).w, 0.001) + span(re).h / max(span(re).w, 0.001)) / 2
    let mouthOpen = span(inner).h / max(span(outer).w, 0.001)
    // 嘴歪：两个嘴角连线相对两眼连线的倾斜，再加上嘴中心偏离两眼中线多少
    var tilt: CGFloat = 0
    if outer.count > 0, le.count > 0, re.count > 0 {
      let l = outer.min(by: { $0.x < $1.x })!, r = outer.max(by: { $0.x < $1.x })!
      let eyeA = atan2(center(re).y - center(le).y, center(re).x - center(le).x)
      let mouthA = atan2(r.y - l.y, r.x - l.x)
      let mid = (center(le).x + center(re).x) / 2
      tilt = abs(mouthA - eyeA) + abs(center(outer).x - mid) / max(abs(center(re).x - center(le).x), 0.001) * 0.5
    }
    let qual = (q.results ?? []).max(by: { $0.boundingBox.width < $1.boundingBox.width })?.faceCaptureQuality ?? 0
    var o: [String: Any] = ["file": p, "face": true, "size": r4(f.boundingBox.height), "gaze": r4(gaze), "eyeOpen": r4(eyeOpen), "mouthOpen": r4(mouthOpen), "mouthTilt": r4(tilt), "quality": r4(CGFloat(qual))]
    if let y = f.yaw { o["yaw"] = r4(CGFloat(truncating: y)) }
    if let r = f.roll { o["roll"] = r4(CGFloat(truncating: r)) }
    out.append(o)
  }
  emit(out)
}

let args = Array(CommandLine.arguments.dropFirst())
if args.count >= 2 && args[0] == "face" {
  faces(Array(args.dropFirst()))
} else if args.count >= 2 && args[0] == "look" {
  look(Array(args.dropFirst()))
} else if args.count >= 2 && args[0] == "text" {
  text(args[1], args.count >= 3 ? args[2] : nil)
} else {
  FileHandle.standardError.write("用法：vision face <图片>... ｜ vision look <图片>... ｜ vision text <图片> [要找的字]\n".data(using: .utf8)!)
  exit(2)
}
