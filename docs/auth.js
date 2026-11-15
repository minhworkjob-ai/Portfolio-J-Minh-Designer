// Đăng ký / đăng nhập thành viên bằng Firebase Authentication (dịch vụ của Google):
// email + mật khẩu tự tạo, Google, GitHub. Cấu hình Firebase nằm trong site.config.json -> "firebase".
const S = window.SITE || {};
const F = S.firebase || {};
const $ = (s, r = document) => r.querySelector(s);
const msg = $('#authmsg');
const say = (t, c = '') => { msg.textContent = t; msg.className = 'msg ' + c; };
const ERR = {
  'auth/email-already-in-use': 'Email này đã có tài khoản. Hãy chuyển sang "Đăng nhập".',
  'auth/invalid-email': 'Email không hợp lệ.',
  'auth/weak-password': 'Mật khẩu quá yếu, cần ít nhất 8 ký tự.',
  'auth/invalid-credential': 'Email hoặc mật khẩu chưa đúng.',
  'auth/user-not-found': 'Không có tài khoản với email này.',
  'auth/wrong-password': 'Email hoặc mật khẩu chưa đúng.',
  'auth/too-many-requests': 'Thử quá nhiều lần, hãy đợi một lúc rồi thử lại.',
  'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập.',
  'auth/cancelled-popup-request': 'Bạn đã đóng cửa sổ đăng nhập.',
  'auth/popup-blocked': 'Trình duyệt chặn cửa sổ đăng nhập, hãy cho phép popup rồi thử lại.',
  'auth/account-exists-with-different-credential': 'Email này đã đăng ký bằng cách khác (Google, GitHub hoặc mật khẩu). Hãy đăng nhập bằng cách đó.',
  'auth/operation-not-allowed': 'Cách đăng nhập này chưa được bật trong Firebase (Authentication → Sign-in method).',
  'auth/unauthorized-domain': 'Tên miền này chưa được thêm vào Firebase (Authentication → Settings → Authorized domains).',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Cấu hình Firebase (apiKey) chưa đúng, kiểm tra lại mục firebase trong site.config.json.',
  'auth/invalid-api-key': 'Cấu hình Firebase (apiKey) chưa đúng, kiểm tra lại mục firebase trong site.config.json.',
  'auth/network-request-failed': 'Mất kết nối mạng.',
};
const vi = e => ERR[e && e.code] || ('Không thực hiện được: ' + ((e && e.message) || e));

if (!F.apiKey || !F.projectId) {
  $('#setup').hidden = false; $('#authbox').hidden = true;
} else {
  const V = '10.12.2';
  const [{ initializeApp }, A] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
  ]);
  const auth = A.getAuth(initializeApp(F)); auth.languageCode = 'vi';
  let mode = 'signup';

  const setMode = m => {
    mode = m; say('');
    $('#at').textContent = m === 'signup' ? 'Đăng ký' : 'Đăng nhập';
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    document.querySelectorAll('[data-only]').forEach(e => { e.hidden = e.dataset.only !== m; });
    $('#pw').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    $('#authgo').textContent = m === 'signup' ? 'Tạo tài khoản' : 'Đăng nhập';
  };
  document.querySelector('.tabs').onclick = e => { if (e.target.dataset.m) setMode(e.target.dataset.m); };
  setMode('signup');

  const busy = on => document.querySelectorAll('#authbox button').forEach(b => { b.disabled = on; });
  const run = async fn => { busy(true); say('Đang xử lý…'); try { await fn(); } catch (e) { say(vi(e), 'err'); } busy(false); };

  document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => run(async () => {
    const prov = b.dataset.p === 'google' ? new A.GoogleAuthProvider() : new A.GithubAuthProvider();
    await A.signInWithPopup(auth, prov);
  }));

  $('#authform').onsubmit = e => {
    e.preventDefault();
    const email = $('#em').value.trim(), pw = $('#pw').value;
    run(async () => {
      if (mode === 'signup') {
        if (pw.length < 8) throw { code: 'auth/weak-password' };
        if (pw !== $('#pw2').value) throw { message: 'Hai mật khẩu chưa giống nhau.' };
        const c = await A.createUserWithEmailAndPassword(auth, email, pw);
        const name = $('#nm').value.trim();
        if (name) await A.updateProfile(c.user, { displayName: name });
        try { await A.sendEmailVerification(c.user); } catch {}
      } else await A.signInWithEmailAndPassword(auth, email, pw);
    });
  };

  $('#forgot').onclick = e => {
    e.preventDefault();
    const email = $('#em').value.trim();
    if (!email) return say('Hãy nhập email trước, rồi bấm "Quên mật khẩu".', 'err');
    run(async () => { await A.sendPasswordResetEmail(auth, email); say('Đã gửi email đặt lại mật khẩu tới ' + email + '.', 'ok'); });
  };

  $('#signout').onclick = () => A.signOut(auth);
  A.onAuthStateChanged(auth, u => {
    $('#authbox').hidden = !!u; $('#acct').hidden = !u;
    if (!u) return;
    $('#aname').textContent = u.displayName || u.email;
    $('#amail').textContent = u.email + (u.emailVerified ? ' · đã xác minh' : ' · chưa xác minh (xem hộp thư để xác minh)');
    const ph = $('#aphoto'); if (u.photoURL) { ph.src = u.photoURL; ph.hidden = false; } else ph.hidden = true;
    $('#at').textContent = 'Xin chào';
  });
}
