const getOrderConfirmationTemplate = (order) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h1 style="background-color: #000; color: #fff; padding: 20px; text-align: center;">Order Confirmed</h1>
        <div style="padding: 20px; border: 1px solid #ddd;">
            <p>Hi ${order.user?.firstName || 'Customer'},</p>
            <p>Thank you for your order! We're getting it ready to be shipped. We will notify you when it has been sent.</p>
            
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Total:</strong> ₹${order.totalPrice}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="background-color: #f8f8f8; text-align: left;">
                        <th style="padding: 10px;">Item</th>
                        <th style="padding: 10px;">Qty</th>
                        <th style="padding: 10px;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.orderItems.map(item => `
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                                ${item.name} <br>
                                <small style="color: #777;">${item.selectedVariant ? `${item.selectedVariant.size} - ${item.selectedVariant.color}` : ''}</small>
                            </td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.qty}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">₹${item.price}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 20px; text-align: center;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/order/${order._id}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order</a>
            </div>
        </div>
        <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">
            &copy; ${new Date().getFullYear()} HighPhaus. All rights reserved.
        </p>
    </div>
    `;
};

const getReturnStatusTemplate = (order, item, status, comment) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h1 style="background-color: #000; color: #fff; padding: 20px; text-align: center;">Return Update</h1>
        <div style="padding: 20px; border: 1px solid #ddd;">
            <p>Hi ${order.user?.firstName || 'Customer'},</p>
            <p>The status of your return request for <strong>${item.name}</strong> has been updated.</p>
            
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                <h2 style="margin: 0; color: #000;">${status}</h2>
                ${comment ? `<p style="margin-top: 10px; color: #555;">Note: ${comment}</p>` : ''}
            </div>

            <p>You can track the progress in your account.</p>

            <div style="margin-top: 20px; text-align: center;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/my-returns" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Return</a>
            </div>
        </div>
    </div>
    `;
};

const getWelcomeTemplate = (user) => {
    return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; line-height: 1.6; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="text-align: center; padding: 40px 0; border-bottom: 1px solid #f5f5f5; background: #fff;">
            <h1 style="font-size: 32px; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: uppercase;">SLOOK</h1>
        </div>
        
        <div style="padding: 50px 30px; text-align: center; background: #fff;">
            <h2 style="font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 15px; color: #000;">Welcome to SLOOK, ${user.firstName}!</h2>
            <p style="color: #666; margin-bottom: 35px; font-size: 16px;">We’re thrilled to have you here. Get ready to explore our modern collection of essentials designed just for you.</p>
            
            <div style="margin-bottom: 35px;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/shop" style="background: #000; color: #fff; display: inline-block; padding: 15px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Start Shopping</a>
            </div>
            
            <p style="font-size: 14px; color: #888;">If you have any questions, feel free to reply to this email.</p>
        </div>

        <div style="background: #fafafa; border-top: 1px solid #eee; padding: 30px; text-align: center;">
            <p style="font-size: 11px; color: #aaa; margin: 0;">&copy; ${new Date().getFullYear()} SLOOK. All rights reserved.</p>
        </div>
    </div>
    `;
};

const getShippingConfirmationTemplate = (order) => {
    return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; line-height: 1.6; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="text-align: center; padding: 40px 0; border-bottom: 1px solid #f5f5f5; background: #fff;">
            <h1 style="font-size: 32px; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: uppercase;">SLOOK</h1>
        </div>
        
        <div style="padding: 50px 30px; text-align: center; background: #fff;">
            <h2 style="font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 15px; color: #000;">Your Order Has Shipped!</h2>
            <p style="color: #666; margin-bottom: 25px; font-size: 16px;">Great news! Your order <strong>#${order._id}</strong> is on its way.</p>
            
            ${order.trackingId ? `
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: left;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #888; text-transform: uppercase; font-weight: bold;">Tracking Information</p>
                <p style="margin: 0 0 5px 0;"><strong>Provider:</strong> ${order.deliveryPartner || 'Standard Shipping'}</p>
                <p style="margin: 0;"><strong>Tracking ID:</strong> <span style="font-family: monospace; background: #eee; padding: 2px 5px; border-radius: 3px;">${order.trackingId}</span></p>
            </div>
            ` : ''}

            <div style="margin-bottom: 35px;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/order/${order._id}" style="background: #000; color: #fff; display: inline-block; padding: 15px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Track Your Order</a>
            </div>
        </div>

        <div style="background: #fafafa; border-top: 1px solid #eee; padding: 30px; text-align: center;">
            <p style="font-size: 11px; color: #aaa; margin: 0;">&copy; ${new Date().getFullYear()} SLOOK. All rights reserved.</p>
        </div>
    </div>
    `;
};


const getAbandonedCartTemplate = (user, cartItems) => {
    const totalValue = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; line-height: 1.6; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="text-align: center; padding: 40px 0; border-bottom: 1px solid #f5f5f5; background: #fff;">
            <h1 style="font-size: 32px; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: uppercase;">SLOOK</h1>
        </div>
        
        <div style="padding: 50px 30px; text-align: center; background: #fff;">
            <h2 style="font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 15px; color: #000;">You left something behind...</h2>
            <p style="color: #666; margin-bottom: 35px; font-size: 16px;">Hi ${user.firstName}, we saved the items in your cart. They are ready when you are.</p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: left;">
                ${cartItems.map(item => `
                    <div style="display: flex; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                        <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 15px;">
                        <div>
                            <p style="margin: 0; font-weight: bold; font-size: 14px;">${item.name}</p>
                            <p style="margin: 0; font-size: 12px; color: #777;">Quantity: ${item.quantity} • ₹${item.price}</p>
                        </div>
                    </div>
                `).join('')}
                <div style="text-align: right; margin-top: 15px;">
                     <p style="margin: 0; font-size: 14px; font-weight: bold;">Total: ₹${totalValue}</p>
                </div>
            </div>

            <div style="margin-bottom: 35px;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/cart" style="background: #000; color: #fff; display: inline-block; padding: 15px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Complete Order</a>
            </div>
        </div>

        <div style="background: #fafafa; border-top: 1px solid #eee; padding: 30px; text-align: center;">
            <p style="font-size: 11px; color: #aaa; margin: 0;">&copy; ${new Date().getFullYear()} SLOOK. All rights reserved.</p>
        </div>
    </div>
    `;
};

module.exports = { getOrderConfirmationTemplate, getReturnStatusTemplate, getWelcomeTemplate, getShippingConfirmationTemplate, getAbandonedCartTemplate };
