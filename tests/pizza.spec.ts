import { test, expect } from 'playwright-test-coverage';

test('home page', async ({ page }) => {
  await page.goto('/');

  expect(await page.title()).toBe('JWT Pizza');
});

test('buy pizza with login', async ({ page }) => {
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  await page.route('*/**/api/franchise', async (route) => {
    const franchiseRes = [
      {
        id: 2,
        name: 'LotaPizza',
        stores: [
          { id: 4, name: 'Lehi' },
          { id: 5, name: 'Springville' },
          { id: 6, name: 'American Fork' },
        ],
      },
      { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
      { id: 4, name: 'topSpot', stores: [] },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchiseRes });
  });

  await page.route('*/**/api/auth', async (route) => {
    const loginReq = { email: 'd@jwt.com', password: 'a' };
    const loginRes = { user: { id: 3, name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: 'diner' }] }, token: 'abcdef' };
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataJSON()).toMatchObject(loginReq);
    await route.fulfill({ json: loginRes });
  });

  await page.route('*/**/api/order', async (route) => {
    const orderReq = {
      items: [
        { menuId: 1, description: 'Veggie', price: 0.0038 },
        { menuId: 2, description: 'Pepperoni', price: 0.0042 },
      ],
      storeId: '4',
      franchiseId: 2,
    };
    const orderRes = {
      order: {
        items: [
          { menuId: 1, description: 'Veggie', price: 0.0038 },
          { menuId: 2, description: 'Pepperoni', price: 0.0042 },
        ],
        storeId: '4',
        franchiseId: 2,
        id: 23,
      },
      jwt: 'eyJpYXQ',
    };
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toMatchObject(orderReq);
    await route.fulfill({ json: orderRes });
  });

  await page.goto('/');

  // Go to order page
  await page.getByRole('button', { name: 'Order now' }).click();

  // Create order
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Login
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  // Pay
  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  // Check balance
  await expect(page.getByText('0.008')).toBeVisible();
});

test('create and close store as franchisee', async ({ page }) => {
  let callsToFranchisee13 = 0;

  await page.route('*/**/api/auth', async (route) => {
    const loginReq = { email: 'f@jwt.com', password: 'franchisee' };
    const loginRes = { user: { id: 13, name: 'pizza franchisee', email: 'f@jwt.com', roles: [{ objectId: 13, role: 'franchisee' }, { role: 'diner' }] }, token: 'abcdef' };
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataJSON()).toMatchObject(loginReq);
    await route.fulfill({ json: loginRes });
  });
  
  await page.route('*/**/api/franchise/13/store', async (route) => {
    const franchiseRes = { id: 20, franchiseId: 13, name: 'Golden Creek' };
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: franchiseRes });
  });

  await page.route('*/**/api/franchise/13/store/20', async (route) => {
    const franchiseRes = { message: "store deleted" };
    expect(route.request().method()).toBe('DELETE');
    await route.fulfill({ json: franchiseRes });
  });

  await page.route('*/**/api/franchise/13', async (route) => {
    const franchiseRes_1 = [
      {
        id: 13,
        name: 'pizzaPocket',
        admins: [
          { id: 13, name: 'pizza franchisee', email: 'f@jwt.com' },
        ],
        stores: [
          { id: 4, name: 'Orem', totalRevenue: 0 },
        ]
      }
    ];

    const franchiseRes_2 = [
      {
        id: 13,
        name: 'pizzaPocket',
        admins: [
          { id: 13, name: 'pizza franchisee', email: 'f@jwt.com' },
        ],
        stores: [
          { id: 4, name: 'Orem', totalRevenue: 0 },
          { id: 20, name: 'Golden Creek', totalRevenue: 0 }
        ]
      }
    ];

    expect(route.request().method()).toBe('GET');
    if (callsToFranchisee13 == 1) {
      await route.fulfill({ json: franchiseRes_2 });
    } else {
      await route.fulfill({ json: franchiseRes_1 });
    }
  });

  await page.goto('/');

  // Login as franchisee
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByPlaceholder('Email address').fill('f@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByLabel('Global')).toContainText('pf');

  // Go to franchise
  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();
  await expect(page.getByRole('main')).toContainText('Everything you need to run an JWT Pizza franchise. Your gateway to success.');
  callsToFranchisee13 += 1;

  // create new store
  await page.getByRole('button', { name: 'Create store' }).click();
  await page.getByPlaceholder('store name').click();
  await page.getByPlaceholder('store name').fill('Golden Creek');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('tbody')).toContainText('Golden Creek');
  callsToFranchisee13 += 1;

  // delete new store
  await page.getByRole('button', { name: 'Close' }).nth(1).click();
  await expect(page.getByRole('main')).toContainText('Golden Creek');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('tbody')).not.toContainText('Golden Creek');
});

test('create and delete franchise as admin', async ({ page }) => {
  let callsToFranchise = 0;

  await page.route('*/**/api/auth', async (route) => {
    const loginReq = { email: 'a@jwt.com', password: 'admin' };
    const loginRes = { user: { id: 2, name: '常用名字', email: 'f@jwt.com', roles: [{ role: 'admin' }] }, token: 'abcdef' };
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataJSON()).toMatchObject(loginReq);
    await route.fulfill({ json: loginRes });
  });
  
  await page.route('*/**/api/franchise/21', async (route) => {
    const franchiseRes = { message: "franchise deleted" };
    expect(route.request().method()).toBe('DELETE');
    await route.fulfill({ json: franchiseRes });
  });

  await page.route('*/**/api/franchise', async (route) => {
    const franchiseRes = { stores: [], name: 'Little Ceasars', admins: [{ email: 'f@jwt.com', id: 13, name: "pizza franchisee" }], id: 21};
    
    if (route.request().method() == 'POST') {
      await route.fulfill({ json: franchiseRes });
    }
    else {
      const franchiseRes_1 = [
        {
          id: 13,
          name: 'pizzaPocket',
          admins: [
            { id: 13, name: 'pizza franchisee', email: 'f@jwt.com' },
          ],
          stores: [
            { id: 4, name: 'Orem', totalRevenue: 0 },
          ]
        }
      ];

      const franchiseRes_2 = [
        {
          id: 13,
          name: 'pizzaPocket',
          admins: [
            { id: 13, name: 'pizza franchisee', email: 'f@jwt.com' },
          ],
          stores: [
            { id: 4, name: 'Orem', totalRevenue: 0 }
          ]
        },
        {
          id: 21,
          name: 'Little Ceasars',
          admins: [
            { id: 13, name: 'pizza franchisee', email: 'f@jwt.com' },
          ],
          stores: []
        }
      ];

      expect(route.request().method()).toBe('GET');
      if (callsToFranchise == 1) {
        await route.fulfill({ json: franchiseRes_2 });
      } else {
        await route.fulfill({ json: franchiseRes_1 });
      }
    }
  });
  
  await page.goto('/');

  // Login as admin
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('a@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByLabel('Global')).toContainText('常');

  // Go to admin dashboard
  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByRole('main')).toContainText('Keep the dough rolling and the franchises signing up.');
  callsToFranchise += 1;

  // Add a franchise
  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await page.getByPlaceholder('franchise name').click();
  await page.getByPlaceholder('franchise name').fill('Little Ceasars');
  await page.getByPlaceholder('franchise name').press('Tab');
  await page.getByPlaceholder('franchisee admin email').fill('f@jwt.com');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('table')).toContainText('Little Ceasars');
  callsToFranchise += 1;

  // Delete a franchise
  await page.getByRole('row', { name: 'Little Ceasars pizza' }).getByRole('button').click();
  await expect(page.getByRole('main')).toContainText('Little Ceasars');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('table')).not.toContainText('Little Ceasars');
});