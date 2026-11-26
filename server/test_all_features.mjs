import http from 'node:http';
import { createApp } from './src/app.js';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 STARTING COMPREHENSIVE PLATFORM TEST SUITE');
  console.log('====================================================\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  let passed = 0;
  let failed = 0;

  async function req(endpoint, options = {}, token = null) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, ok: res.ok, data: json, headers: res.headers };
  }

  function assert(testName, condition, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}: ${details}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Health Check
    // ----------------------------------------------------
    const health = await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.json());
    assert('Health Check Endpoint', health?.data?.status === 'ok', JSON.stringify(health));

    // ----------------------------------------------------
    // TEST 2: Super Admin Login
    // ----------------------------------------------------
    const saLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@schoolcloud.io', password: 'Password@123' }),
    });
    assert('Super Admin Login', saLogin.ok && saLogin.data?.data?.accessToken, `Status ${saLogin.status}`);
    const saToken = saLogin.data?.data?.accessToken;

    // ----------------------------------------------------
    // TEST 3: Super Admin Dashboard & Database Stats
    // ----------------------------------------------------
    const saDash = await req('/superadmin/dashboard', { method: 'GET' }, saToken);
    assert('Super Admin Dashboard Metrics', saDash.ok && saDash.data?.data?.totalSchools > 0);

    const dbStats = await req('/database/stats', { method: 'GET' }, saToken);
    assert('Database Stats API returns collections', dbStats.ok && Array.isArray(dbStats.data?.data?.collections));

    // ----------------------------------------------------
    // TEST 4: School Onboarding with Custom Branding & Instant Login
    // ----------------------------------------------------
    const testSchoolCode = `TEST${Date.now().toString().slice(-4)}`;
    const testAdminEmail = `admin.${testSchoolCode.toLowerCase()}@testschool.edu`;
    const testAdminPassword = 'TestPassword@123';
    const testSchoolName = `Horizon International ${testSchoolCode}`;
    const testLogoUrl = 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=128&auto=format&fit=crop&q=80';

    const createSchoolRes = await req(
      '/superadmin/schools',
      {
        method: 'POST',
        body: JSON.stringify({
          name: testSchoolName,
          code: testSchoolCode,
          logoUrl: testLogoUrl,
          email: `contact@${testSchoolCode.toLowerCase()}.edu`,
          adminName: 'Principal Horizon',
          adminEmail: testAdminEmail,
          adminPassword: testAdminPassword,
          trialDays: 30,
        }),
      },
      saToken
    );

    assert('Onboard New School with Logo & Custom Password', createSchoolRes.ok && createSchoolRes.data?.data?.school?._id, JSON.stringify(createSchoolRes.data));
    const newSchool = createSchoolRes.data?.data?.school;

    // Verify Newly Created School Admin Login Immediately
    const newAdminLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testAdminEmail,
        password: testAdminPassword,
      }),
    });

    assert('Newly Created School Admin Login (isActive validation)', newAdminLogin.ok && newAdminLogin.data?.data?.accessToken, JSON.stringify(newAdminLogin.data));
    const newAdminToken = newAdminLogin.data?.data?.accessToken;

    // Verify White-Label Branding returned in auth/me
    const meRes = await req('/auth/me', { method: 'GET' }, newAdminToken);
    assert(
      'White-Label School Branding on Login/Me',
      meRes.data?.data?.school?.name === testSchoolName && meRes.data?.data?.school?.logoUrl === testLogoUrl,
      `Expected ${testSchoolName}, got ${meRes.data?.data?.school?.name}`
    );

    // ----------------------------------------------------
    // TEST 5: Verify User's Existing Accounts (khan@gmail.com & khan121@gmail.com)
    // ----------------------------------------------------
    const khanLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'khan@gmail.com', password: 'Password@123' }),
    });
    assert('User Account Login: khan@gmail.com', khanLogin.ok && khanLogin.data?.data?.user?.role === 'school_admin', JSON.stringify(khanLogin.data));

    const khan121Login = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'khan121@gmail.com', password: 'Password@123' }),
    });
    assert('User Account Login: khan121@gmail.com', khan121Login.ok && khan121Login.data?.data?.user?.role === 'school_admin', JSON.stringify(khan121Login.data));

    // ----------------------------------------------------
    // TEST 6: School Access Kill-Switch (Suspend & Reactivate)
    // ----------------------------------------------------
    const suspendRes = await req(
      `/superadmin/schools/${newSchool._id}/suspend`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'Audit suspension test' }),
      },
      saToken
    );
    assert('Suspend School via Kill-Switch', suspendRes.ok && suspendRes.data?.data?.status === 'suspended');

    // Verify school admin subscription state shows blocked/suspended
    const blockedSubRes = await req('/admin/subscription', { method: 'GET' }, newAdminToken);
    assert('Suspended School Subscription statusInfo.isBlocked = true', blockedSubRes.data?.data?.statusInfo?.isBlocked === true);

    // Reactivate School
    const reactivateRes = await req(`/superadmin/schools/${newSchool._id}/reactivate`, { method: 'POST' }, saToken);
    assert('Reactivate School via Kill-Switch', reactivateRes.ok && reactivateRes.data?.data?.status === 'active');

    // ----------------------------------------------------
    // TEST 7: Subscription Payment Gateway Checkout (School Admin)
    // ----------------------------------------------------
    const subPayRes = await req(
      '/admin/subscription/checkout',
      {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: 'card',
          billingCycle: 'monthly',
          transactionReference: `PAY-TEST-${Date.now()}`,
        }),
      },
      newAdminToken
    );
    assert('School Admin Subscription Payment Gateway Checkout', subPayRes.ok && subPayRes.data?.data?.payment?.invoiceNo, JSON.stringify(subPayRes.data));

    // Verify Invoice PDF Generation
    if (subPayRes.data?.data?.payment?._id) {
      const pdfRes = await fetch(`${baseUrl}/admin/subscription/receipt/${subPayRes.data.data.payment._id}`, {
        headers: { Authorization: `Bearer ${newAdminToken}` },
      });
      const isPdf = pdfRes.headers.get('content-type')?.includes('application/pdf');
      assert('Subscription Official Tax Invoice PDF Download', isPdf);
    }

    // ----------------------------------------------------
    // TEST 8: School Admin Academics & Student Registration
    // ----------------------------------------------------
    // Greenfield School Admin
    const gfAdminLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@greenfield.edu', password: 'Password@123' }),
    });
    const gfAdminToken = gfAdminLogin.data?.data?.accessToken;

    const classesRes = await req('/admin/classes', { method: 'GET' }, gfAdminToken);
    assert('School Admin List Classes', classesRes.ok && Array.isArray(classesRes.data?.data));
    const testClass = classesRes.data?.data?.[0];

    const sectionsRes = await req('/admin/sections', { method: 'GET' }, gfAdminToken);
    const testSection = sectionsRes.data?.data?.[0];

    // Register a Student with linked parent
    const regStudentRes = await req(
      '/admin/students',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Samantha Test',
          email: `samantha.${Date.now()}@greenfield.edu`,
          classId: testClass?._id,
          sectionId: testSection?._id,
          rollNo: 'TEST-01',
          gender: 'female',
          parentName: 'Mr. David Test',
          parentEmail: `david.test.${Date.now()}@gmail.com`,
          password: 'Password@123',
        }),
      },
      gfAdminToken
    );
    assert('Register Student with Auto-Admission & Linked Parent', regStudentRes.ok && regStudentRes.data?.data?.admissionNo, JSON.stringify(regStudentRes.data));

    // ----------------------------------------------------
    // TEST 9: Faculty Attendance & Marks
    // ----------------------------------------------------
    const facultyLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'marcus.gf@greenfield.edu', password: 'Password@123' }),
    });
    assert('Faculty Login', facultyLogin.ok && facultyLogin.data?.data?.accessToken);
    const facultyToken = facultyLogin.data?.data?.accessToken;

    const facultyDash = await req('/faculty/dashboard', { method: 'GET' }, facultyToken);
    assert('Faculty Dashboard', facultyDash.ok && facultyDash.data?.data?.classesCount >= 0);

    // ----------------------------------------------------
    // TEST 10: Student Results & Resources
    // ----------------------------------------------------
    const studentLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'liam.gf@greenfield.edu', password: 'Password@123' }),
    });
    assert('Student Login', studentLogin.ok && studentLogin.data?.data?.accessToken);
    const studentToken = studentLogin.data?.data?.accessToken;

    const studentResults = await req('/student/results', { method: 'GET' }, studentToken);
    assert('Student Results Screen (results + scheduled exams)', studentResults.ok && Array.isArray(studentResults.data?.data?.results));

    // ----------------------------------------------------
    // TEST 11: Parent Portal & Online Fee Payment Gateway
    // ----------------------------------------------------
    const parentLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'parent.gf@greenfield.edu', password: 'Password@123' }),
    });
    assert('Parent Login', parentLogin.ok && parentLogin.data?.data?.accessToken);
    const parentToken = parentLogin.data?.data?.accessToken;

    const parentChildren = await req('/parent/children', { method: 'GET' }, parentToken);
    assert('Parent Portal: Linked Children', parentChildren.ok && parentChildren.data?.data?.length > 0);
    const child = parentChildren.data?.data?.[0];

    // Parent Child Fees
    const childFees = await req(`/parent/children/${child._id}/fees`, { method: 'GET' }, parentToken);
    assert('Parent Portal: Child Fee Structures & Status', childFees.ok && Array.isArray(childFees.data?.data?.feeStatus));

    // Parent Pays Fee Online through Payment Gateway
    if (childFees.data?.data?.feeStatus?.length > 0) {
      const targetStructure = childFees.data.data.feeStatus[0].structure;
      const feePayRes = await req(
        `/parent/children/${child._id}/fees/pay`,
        {
          method: 'POST',
          body: JSON.stringify({
            feeStructureId: targetStructure._id,
            amountPaid: targetStructure.totalAmount,
            paymentMethod: 'card',
            transactionReference: `GATEWAY-PAR-${Date.now()}`,
          }),
        },
        parentToken
      );
      assert('Parent Online Fee Payment Gateway Checkout', feePayRes.ok && feePayRes.data?.data?.receiptNo, JSON.stringify(feePayRes.data));

      if (feePayRes.data?.data?._id) {
        const feePdf = await fetch(`${baseUrl}/fees/payments/${feePayRes.data.data._id}/receipt`, {
          headers: { Authorization: `Bearer ${parentToken}` },
        });
        const isPdf = feePdf.headers.get('content-type')?.includes('application/pdf');
        assert('Official School Fee PDF Receipt Download', isPdf);
      }
    }

  } catch (err) {
    console.error('UNEXPECTED TEST EXCEPTION:', err);
    failed++;
  } finally {
    server.close();
    console.log('\n====================================================');
    console.log(`🏁 TEST SUITE COMPLETE: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
