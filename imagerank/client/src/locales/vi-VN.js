// Vietnamese (issue #58). Complete: all 261 keys are translated, so nothing falls
// back to English.
//
// Two conventions followed throughout: the reader is addressed as "bạn" (informal
// singular), which suits a volunteer study better than the formal "quý vị"; and
// "image" is rendered "ảnh"/"hình ảnh" in the sense of a photograph, never "hình
// tượng". The study's two key terms are kept consistent everywhere they appear —
// "thực tế nhất" for most realistic and "yêu thích" for favourite — since the whole
// study measures the gap between them.
export default {
  'lang.label': 'Ngôn ngữ',
  'lang.choose': 'Chọn ngôn ngữ',

  'home.eyebrow': 'IEEE 1858 · Nghiên cứu tâm lý vật lý',
  'home.title': 'Xếp hạng ảnh',
  'home.lead1':
    'Nghiên cứu này tìm hiểu cách {sharpening} và xử lý ảnh {hdr} thay đổi cảm nhận của người xem về một bức ảnh. Bạn sẽ xem cùng một ảnh được xử lý ở nhiều mức khác nhau và chọn phiên bản bạn {favorite}, cùng phiên bản trông {mostRealistic}.',
  'home.lead1.sharpening': 'làm nét',
  'home.lead1.hdr': 'HDR',
  'home.lead1.favorite': 'yêu thích nhất',
  'home.lead1.mostRealistic': 'thực tế nhất',
  'home.lead2':
    'Hai lựa chọn này không nhất thiết phải giống nhau. Ảnh thực tế nhất không phải lúc nào cũng là ảnh trông bóng bẩy nhất, và chính khoảng cách đó là điều chúng tôi muốn đo.',
  'home.viewingNote':
    'Để kết quả nhất quán, vui lòng thực hiện nghiên cứu trên máy tính để bàn hoặc laptop, trong điều kiện ánh sáng trong nhà.',

  'home.cta.start': 'Bắt đầu nghiên cứu',
  'home.cta.resume': 'Tiếp tục nghiên cứu',
  'home.cta.signedInAs': 'Đã đăng nhập với {email}. {signOut}',
  'home.cta.signOut': 'Đăng xuất',
  'home.cta.haveAccount': 'Bạn đã có tài khoản, hoặc muốn tiếp tục trên thiết bị khác? {signIn}',
  'home.cta.signIn': 'Đăng nhập',

  'home.mobile.title': 'Vui lòng chuyển sang máy tính để bàn hoặc laptop.',
  'home.mobile.body':
    'Việc xem chính xác cần màn hình lớn hơn trong điều kiện ánh sáng trong nhà. Hãy mở trang này ({url}) trên máy tính để bàn hoặc laptop để tham gia nghiên cứu.',

  'home.examples.title': 'Ảnh ví dụ',
  'home.examples.subtitle':
    'Một số ảnh bạn sẽ xếp hạng. Bạn có thể xem toàn bộ bộ ảnh trước khi bắt đầu.',
  'home.examples.loading': 'Đang tải ảnh ví dụ…',
  'home.examples.hdr.title': 'HDR',
  'home.examples.hdr.blurb': 'Ánh xạ tông màu dải động cao qua các mức xử lý.',
  'home.examples.hdr.preview': 'Xem ảnh HDR',
  'home.examples.sharpness.title': 'Độ nét',
  'home.examples.sharpness.blurb': 'Làm nét bằng mặt nạ mờ qua các mức xử lý.',
  'home.examples.sharpness.preview': 'Xem ảnh độ nét',
  'home.examples.view': 'Xem {label}',

  'home.about.title': 'Ai thực hiện nghiên cứu này?',
  'home.about.body1':
    'Nghiên cứu này do nhóm công tác {link} thực hiện — một nhóm gồm các kỹ sư và nhà nghiên cứu về hình ảnh, xây dựng các tiêu chuẩn mở để đo xem ảnh của một máy ảnh thực sự trông đẹp đến đâu đối với con người.',
  'home.about.linkText': 'IEEE 1858 Camera Perceptual Image Quality',
  'home.about.body2':
    'Chất lượng điện thoại và máy ảnh từ lâu được mô tả bằng những con số như megapixel, nhưng các con số đó không luôn khớp với những gì mắt chúng ta thực sự nhận ra. Từ khi công bố tiêu chuẩn đầu tiên năm 2016 (với các bản cập nhật năm 2023 và một bản khác đang được xây dựng), nhóm đã nỗ lực đo chất lượng ảnh theo đúng cách người xem thực sự cảm nhận, để có thể so sánh công bằng máy ảnh của các nhà sản xuất khác nhau. Lựa chọn của bạn trong nghiên cứu này giúp kết nối các phép đo đó với cảm nhận thực của con người.',
  'home.about.learnMore': 'Tìm hiểu thêm về IEEE 1858 →',

  'home.footer.title': 'Bộ ảnh và giấy phép',
  'home.footer.body':
    'Ảnh dùng trong nghiên cứu lấy từ {dataset} (Bychkovsky et al., 2011), được sử dụng theo giấy phép nghiên cứu {adobe} và {adobeMit}. Giấy phép áp dụng cho từng ảnh được liên kết trong bảng thông tin ({icon}) của ảnh đó.',
  'home.footer.dataset': 'MIT-Adobe FiveK Dataset',
  'home.footer.adobe': 'Adobe',
  'home.footer.adobeMit': 'Adobe–MIT',

  'consent.label': 'Đồng ý phân tích dữ liệu',
  'consent.body':
    'Chúng tôi muốn dùng Google Analytics để biết khách truy cập tìm đến và di chuyển trong nghiên cứu này như thế nào. Công cụ này đặt cookie và chia sẻ dữ liệu sử dụng với Google. Chúng tôi sẽ không dùng nó để nhận dạng bạn hay liên kết với câu trả lời của bạn. Xem {policy} của chúng tôi.',
  'consent.accept': 'Đồng ý',
  'consent.decline': 'Từ chối',

  'privacy.title': 'Chính sách bảo mật',
  'privacy.eyebrow': 'Cách chúng tôi xử lý dữ liệu của bạn',
  'privacy.link': 'Chính sách bảo mật',
  'privacy.englishOnly':
    'Hiện chính sách này chỉ có bản tiếng Anh. Bản tiếng Anh là bản có hiệu lực.',

  'done.eyebrow': 'Đã hoàn thành nghiên cứu',
  'done.title': 'Cảm ơn bạn!',
  'done.recordedOne': 'Câu trả lời của bạn cho 1 ảnh đã xếp hạng đã được ghi nhận.',
  'done.recordedMany': 'Câu trả lời của bạn cho toàn bộ {count} ảnh đã xếp hạng đã được ghi nhận.',
  'done.recordedNone': 'Câu trả lời của bạn đã được ghi nhận.',
  'done.thanks': 'Chúng tôi rất cảm ơn thời gian bạn đã dành để tham gia nghiên cứu này.',
  'done.reviewRanked': 'Xem lại những ảnh bạn đã xếp hạng',
  'done.noneLeft':
    'Bạn đã xem hết mọi ảnh có trong nghiên cứu. Cảm ơn bạn đã làm rất kỹ lưỡng!',
  'done.moreTimePrompt':
    'Bạn còn thêm một chút thời gian? Chúng tôi có thể cho bạn xem thêm những ảnh bạn chưa thấy.',
  'done.moreMinuteOne': 'thêm {count} phút',
  'done.moreMinuteMany': 'thêm {count} phút',
  'done.minutesShort': '{value} phút',
  'done.loadingMore': 'Đang tải thêm ảnh…',
  'done.reviewMore': 'Xem thêm ảnh',
  'done.shareTitle': 'Bạn có biết ai đó có con mắt tinh tường?',
  'done.shareBlurb':
    'Mỗi người tham gia thêm đều giúp kết quả chính xác hơn. Hãy mời một ai đó cùng làm:',
  'done.closeTab': 'Bạn cũng có thể đóng thẻ này.',
  'done.returnHome': 'Trở về trang chủ',

  'contact.title': 'Bạn có muốn nhận thông tin từ chúng tôi?',
  'contact.results': 'Gửi email cho tôi khi kết quả nghiên cứu này được công bố',
  'contact.futureStudies': 'Liên hệ với tôi để tham gia các nghiên cứu sau này',
  'contact.emailLabel': 'Địa chỉ email',
  'contact.save': 'Lưu',
  'contact.update': 'Cập nhật',
  'contact.saving': 'Đang lưu…',
  'contact.savedBoth':
    'Cảm ơn bạn — chúng tôi sẽ gửi email về kết quả và về các nghiên cứu sau này.',
  'contact.savedResults': 'Cảm ơn bạn — chúng tôi sẽ gửi email khi kết quả được công bố.',
  'contact.savedFuture': 'Cảm ơn bạn — chúng tôi sẽ gửi email về các nghiên cứu sau này.',
  'contact.savedNone': 'Đã hủy. Chúng tôi sẽ không gửi email cho bạn.',
  'contact.errorSave': 'Không lưu được lựa chọn của bạn.',
  'contact.errorEmail': 'Vui lòng nhập địa chỉ email hợp lệ.',

  'rankings.eyebrow': 'Xếp hạng của bạn',
  'rankings.title': 'Xem lại và chỉnh sửa',
  'rankings.lead':
    'Đây là những ảnh bạn đã xếp hạng. Chọn bất kỳ ảnh nào để xem lại và thay đổi lựa chọn thực tế nhất và yêu thích của bạn.',
  'rankings.backToStudy': 'Trở lại nghiên cứu',
  'rankings.loading': 'Đang tải xếp hạng của bạn…',
  'rankings.empty':
    'Bạn chưa xếp hạng ảnh nào. Khi bạn xếp hạng một ảnh, ảnh đó sẽ xuất hiện ở đây.',
  'rankings.revisit': 'Xem lại và xếp hạng lại ảnh này',
  'rankings.noThumb': 'không có ảnh thu nhỏ',
  'rankings.errorLoad': 'Không tải được xếp hạng của bạn.',

  'preview.eyebrow': 'Xem trước',
  'preview.title': 'Ảnh ví dụ',
  'preview.lead':
    'Xem toàn bộ ảnh trong từng bộ. Nhấp vào bất kỳ ảnh nào để mở trình xem và di chuyển qua các mức xử lý của ảnh. Trong nghiên cứu, bạn sẽ lần lượt xếp hạng từng ảnh.',
  'preview.loading': 'Đang tải ảnh…',
  'preview.noCollection': 'Không có bộ ảnh nào tên “{name}”. Hãy thử {hdr} hoặc {sharpness}.',
  'preview.backHome': 'Trở về trang chủ',
  'preview.collectionEyebrow': 'Xem trước {collection}',
  'preview.viewerTitle': 'Trình xem ảnh',
  'preview.viewerLead':
    'Di chuyển thanh trượt để so sánh các mức xử lý. Đây chỉ là bản xem trước — các lựa chọn ở đây không được ghi nhận.',
  'preview.loadingImage': 'Đang tải ảnh…',
  'preview.notFound': 'Không tìm thấy ảnh đó. {link}.',
  'preview.backToGallery': 'Trở lại thư viện ảnh',
  'preview.backToPreview': 'Trở lại phần xem trước ảnh',

  'signin.title': 'Đăng nhập',
  'signin.createTitle': 'Tạo tài khoản',
  'signin.lead':
    'Đăng nhập để tiếp tục nghiên cứu trên thiết bị này hoặc thiết bị khác. Việc đăng nhập là không bắt buộc.',
  'signin.createLead':
    'Tạo một tài khoản không bắt buộc để lưu tiến độ và tiếp tục trên thiết bị khác.',
  'signin.email': 'Email',
  'signin.password': 'Mật khẩu',
  'signin.submit': 'Đăng nhập',
  'signin.createSubmit': 'Tạo tài khoản',
  'signin.signingIn': 'Đang đăng nhập…',
  'signin.creating': 'Đang tạo tài khoản…',
  'signin.google': 'Tiếp tục với Google',
  'signin.haveAccount': 'Bạn đã có tài khoản?',
  'signin.newHere': 'Bạn mới đến?',
  'signin.error.googleUnavailable':
    'Chưa thiết lập đăng nhập bằng Google. Vui lòng dùng email và mật khẩu.',
  'signin.error.googleDenied': 'Đã hủy đăng nhập bằng Google.',
  'signin.error.badState': 'Phiên đăng nhập của bạn đã hết hạn. Vui lòng thử lại.',
  'signin.error.googleFailed': 'Đăng nhập bằng Google không thành công. Vui lòng thử lại.',
  'signin.error.network': 'Không kết nối được với máy chủ. Vui lòng thử lại.',

  'auth.finishing': 'Đang hoàn tất đăng nhập…',
  'auth.failed': 'Chúng tôi không hoàn tất được việc đăng nhập. Vui lòng thử lại.',

  'info.title': 'Thông tin ảnh',
  'info.category': 'Phân loại',
  'info.license': 'Giấy phép',
  'info.unavailable': 'Không có dữ liệu gốc cho ảnh này.',
  'info.note': 'Dữ liệu mô tả bức ảnh gốc, chưa qua xử lý.',
  'info.licenseAdobe': 'Giấy phép nghiên cứu Adobe',
  'info.licenseAdobeMit': 'Giấy phép nghiên cứu Adobe–MIT',
  'info.subject': 'Chủ thể',
  'info.light': 'Ánh sáng',
  'info.location': 'Địa điểm',
  'info.camera': 'Máy ảnh',
  'info.lens': 'Ống kính',
  'info.focalLength': 'Tiêu cự',
  'info.aperture': 'Khẩu độ',
  'info.shutter': 'Tốc độ màn trập',
  'info.iso': 'ISO',
  'info.dateTaken': 'Ngày chụp',
  'info.dimensions': 'Kích thước',

  'tour.fullscreen.title': 'Chào mừng bạn đến với phần đánh giá ảnh',
  'tour.fullscreen.body':
    'Trước tiên, hãy chuyển trình duyệt sang chế độ toàn màn hình để ảnh chiếm hết màn hình — nhấn F11 trên Windows, hoặc Control + Command + F trên máy Mac.',
  'tour.lighting.title': 'Kiểm tra ánh sáng',
  'tour.lighting.body':
    'Hãy thực hiện nghiên cứu trong phòng mà bạn nhìn rõ màn hình. Tránh ánh nắng chiếu trực tiếp hoặc phản chiếu gây chói trên màn hình.',
  'tour.slider.title': 'Thanh trượt mức xử lý',
  'tour.slider.body':
    'Thanh trượt này đi qua các mức xử lý khác nhau áp dụng cho cùng một ảnh, từ chưa xử lý ở bên trái đến xử lý mạnh ở bên phải.',
  'tour.realistic.title': 'Thực tế nhất',
  'tour.realistic.body':
    'Ảnh thực tế nhất là ảnh thể hiện đúng như thật khung cảnh, với màu sắc và tông màu chính xác — không bị cường điệu, cũng không quá mờ.',
  'tour.favorite.title': 'Ảnh yêu thích',
  'tour.favorite.body':
    'Ảnh yêu thích chỉ đơn giản là ảnh bạn thích nhất — phiên bản trong bộ ảnh mà bạn thấy dễ chịu nhất khi nhìn.',
  'tour.explore.title': 'Khám phá cả bộ ảnh',
  'tour.explore.body':
    'Di chuyển thanh trượt sang trái và sang phải cho đến khi bạn tìm được ảnh trông thực tế nhất, và ảnh bạn yêu thích. Mẹo: bạn cũng có thể dùng các phím mũi tên ← và → trên bàn phím.',
  'tour.zoom.title': 'Xem kỹ chi tiết',
  'tour.zoom.body':
    'Phóng to ảnh để xem các chi tiết nhỏ — dùng các nút này, con lăn chuột, hoặc nhấp đúp vào ảnh. Dùng “Đặt lại chế độ xem” để thu nhỏ trở lại.',
  'tour.record.title': 'Ghi lại lựa chọn của bạn',
  'tour.record.body':
    'Khi đã tìm được, hãy nhấp “Chọn ảnh thực tế nhất” hoặc “Chọn ảnh yêu thích” để ghi lại lựa chọn. Một dấu sẽ hiện trên thanh trượt cho biết mức bạn đã chọn.',
  'tour.next.title': 'Chuyển tiếp',
  'tour.next.body':
    'Khi bạn đã hài lòng với ảnh thực tế nhất và ảnh yêu thích đã chọn, hãy nhấp “Ảnh tiếp theo” để tiếp tục.',
  'tour.done': 'Xong',
  'tour.skip': 'Bỏ qua hướng dẫn',
  'tour.next': 'Tiếp',
  'tour.back': 'Lùi',

  'common.close': 'Đóng',

  'share.title': 'Giúp chúng tôi tìm thêm người tham gia',
  'share.blurb': 'Càng nhiều người tham gia, kết quả càng tốt. Hãy chia sẻ nghiên cứu này:',
  'share.blurb.home': 'Nghiên cứu cần rất nhiều đôi mắt. Hãy mời những người sẽ thấy thú vị:',
  'share.blurb.mobile':
    'Bạn có thể làm nghiên cứu trên laptop sau. Trong lúc chờ, hãy gửi cho ai đó đang có laptop:',
  'share.email': 'Email',
  'share.facebook': 'Facebook',
  'share.twitter': 'Twitter',
  'share.bluesky': 'Bluesky',
  'share.mastodon': 'Mastodon',
  'share.linkedin': 'LinkedIn',
  'share.whatsapp': 'WhatsApp',
  'share.reddit': 'Reddit',
  'share.copyLink': 'Sao chép liên kết',
  'share.copied': 'Đã sao chép liên kết: {url}',
  'share.copyManually': 'Hãy sao chép liên kết này: {url}',
  'share.mastodon.dialogTitle': 'Chia sẻ lên Mastodon',
  'share.mastodon.instanceLabel': 'Máy chủ Mastodon',
  'share.mastodon.placeholder': 'mastodon.social',
  'share.mastodon.help':
    'Nhập máy chủ mà bạn có tài khoản. Chúng tôi sẽ ghi nhớ cho lần sau.',
  'share.mastodon.cancel': 'Hủy',
  'share.mastodon.confirm': 'Tiếp tục',
  'share.paste.title': 'Chia sẻ trên {platform}',
  'share.paste.help': '{platform} không cho phép chúng tôi điền sẵn nội dung bài đăng. Hãy sao chép đoạn văn bản bên dưới rồi dán vào bài đăng của bạn.',
  'share.paste.copy': 'Sao chép văn bản',
  'share.paste.copied': 'Đã sao chép văn bản. Hãy dán vào bài đăng của bạn.',
  'share.paste.copyManually': 'Hãy chọn đoạn văn bản ở trên và sao chép, rồi dán vào bài đăng của bạn.',
  'share.paste.continue': 'Sao chép và mở {platform}',
  'share.paste.cancel': 'Hủy',

  'demo.back': '← Trở về trang chủ',
  'demo.backToStudy': '← Trở lại nghiên cứu',
  'demo.eyebrow.before': 'Trước khi bạn bắt đầu',
  'demo.eyebrow.edit': 'Chỉnh sửa thông tin của bạn',
  'demo.title': 'Về bạn',
  'demo.lead':
    'Một vài câu hỏi về bạn và điều kiện xem của bạn. Những thông tin này giúp chúng tôi hiểu đúng kết quả. Tất cả các trường đều bắt buộc.',
  'demo.age': 'Tuổi',
  'demo.gender': 'Giới tính',
  'demo.email': 'Email',
  'demo.emailPlaceholder': 'ban@vidu.com',
  'demo.emailOptional': 'Email (không bắt buộc)',
  'demo.error.emailForAccount':
    'Cần một địa chỉ email để tạo tài khoản. Hãy nhập email, hoặc xóa mật khẩu để tiếp tục mà không cần tài khoản.',
  'demo.selfDescription': 'Bạn tự mô tả mình như thế nào?',
  'demo.visionStatus': 'Thị lực của bạn có bị giảm không?',
  'demo.visionDetails': 'Chi tiết về thị lực',
  'demo.visionDetailsPlaceholder': 'Hãy cho biết chi tiết về thị lực của bạn.',
  'demo.colorBlind': 'Mù màu?',
  'demo.country': 'Quốc gia xuất thân',
  'demo.displayType': 'Loại màn hình nào?',
  'demo.lighting': 'Loại ánh sáng nào?',

  'demo.gender.female': 'Nữ',
  'demo.gender.male': 'Nam',
  'demo.gender.nonBinary': 'Phi nhị nguyên',
  'demo.gender.preferNotToSay': 'Không muốn trả lời',
  'demo.self.regular': 'Người bình thường',
  'demo.self.expert': 'Nhiếp ảnh gia / Chuyên gia hình ảnh',
  'demo.vision.ordinary': 'Không — thị lực bình thường',
  'demo.vision.corrected': 'Không, nhờ kính/kính áp tròng/phẫu thuật',
  'demo.vision.yesDetails': 'Có, cho biết chi tiết',
  'demo.yes': 'Có',
  'demo.no': 'Không',
  'demo.display.laptop': 'Laptop',
  'demo.display.monitor': 'Màn hình ngoài',
  'demo.lighting.dim': 'Ánh sáng yếu',
  'demo.lighting.indoor': 'Ánh sáng trong nhà bình thường',
  'demo.lighting.outdoor': 'Ánh sáng ngoài trời (không khuyến nghị)',

  'demo.account.title': 'Lưu tiến độ trên nhiều thiết bị (không bắt buộc)',
  'demo.account.body':
    'Đặt mật khẩu để tạo tài khoản gắn với email ở trên, rồi đăng nhập trên máy tính khác để tiếp tục từ chỗ bạn đã dừng. Để trống nếu muốn tiếp tục mà không cần tài khoản. Bạn thích dùng Google? {googleLink}.',
  'demo.account.google': 'Đăng nhập bằng Google',
  'demo.password': 'Tạo mật khẩu (không bắt buộc)',
  'demo.passwordHelp': 'Ít nhất {min} ký tự.',

  'demo.error.required': 'Bắt buộc',
  'demo.error.email': 'Nhập địa chỉ email hợp lệ',
  'demo.error.visionDetails': 'Vui lòng cho biết chi tiết về thị lực của bạn',
  'demo.error.fix': 'Vui lòng sửa các trường được đánh dấu trước khi tiếp tục.',
  'demo.error.password': 'Mật khẩu phải có ít nhất {min} ký tự.',
  'demo.error.account': 'Không tạo được tài khoản của bạn. Vui lòng thử lại.',
  'demo.error.save':
    'Chúng tôi không lưu được câu trả lời của bạn. Vui lòng kiểm tra kết nối và thử lại.',

  'demo.cancel': 'Hủy',
  'demo.backHome': 'Trở về trang chủ',
  'demo.saving': 'Đang lưu…',
  'demo.saveReturn': 'Lưu và trở lại nghiên cứu',
  'demo.submit': 'Tiếp tục vào nghiên cứu',

  'study.topbar.title': 'IEEE 1858 CPIQ Image Rank',
  'study.topbar.progress': '{collection}: ảnh {position}/{total}: {image}',
  'study.topbar.reranking': 'Xếp hạng lại: {collection} — {image}',
  'study.slider.aria': 'Mức xử lý',
  'study.marker.realisticAt': 'Thực tế nhất ở mức {level}',
  'study.marker.favoriteAt': 'Ảnh yêu thích ở mức {level}',
  'study.loadingLibrary': 'Đang tải thư viện ảnh…',
  'study.exploreMore':
    'vui lòng kéo thanh trượt sang phải để xem các ảnh được xử lý nhiều hơn trước khi quyết định.',
  'study.topbar.help': 'Xem lại phần hướng dẫn',
  'study.topbar.rankings': 'Xếp hạng',
  'study.topbar.editDemographics': 'Chỉnh sửa thông tin',
  'study.topbar.imageInfo': 'Thông tin ảnh',
  'study.topbar.zoomOut': 'Thu nhỏ',
  'study.topbar.zoomIn': 'Phóng to',
  'study.topbar.resetView': 'Đặt lại chế độ xem',
  'study.slider.unprocessed': 'Chưa xử lý',
  'study.slider.heavilyProcessed': 'Xử lý mạnh',
  'study.pickMostRealistic': 'Chọn ảnh thực tế nhất',
  'study.pickFavorite': 'Chọn ảnh yêu thích',
  'study.previous': 'Ảnh trước',
  'study.nextImage': 'Ảnh tiếp theo',
  'study.saveChanges': 'Lưu thay đổi',
  'study.finish': 'Kết thúc',
  'study.loading.title': 'Đang tải ảnh',

  'share.subject': 'Bạn thích ảnh nào nhất, và ảnh nào trông như thật?',
  'share.text':
    'Bạn thích ảnh nào nhất, và ảnh nào trông như thật? Thường thì đó không phải cùng một ảnh. Các nhà nghiên cứu của IEEE Camera Perceptual Image Quality đang đo khoảng cách đó, và cần người xem ảnh rồi chọn. Không cần chuyên môn.',
}
