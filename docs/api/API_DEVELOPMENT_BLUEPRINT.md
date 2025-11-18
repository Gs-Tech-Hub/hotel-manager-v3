 create a comprehensive api system convertng the strapi schema below to match. Maintain consistency in api design.

import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiAboutAbout extends Struct.SingleTypeSchema {
  collectionName: 'abouts';
  info: {
    description: 'Write about yourself and the content you create';
    displayName: 'About';
    pluralName: 'abouts';
    singularName: 'about';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      ['shared.media', 'shared.quote', 'shared.rich-text', 'shared.slider']
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::about.about'> &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAmenityAmenity extends Struct.CollectionTypeSchema {
  collectionName: 'amenities';
  info: {
    displayName: 'amenity';
    pluralName: 'amenities';
    singularName: 'amenity';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    icon: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::amenity.amenity'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiArticleArticle extends Struct.CollectionTypeSchema {
  collectionName: 'articles';
  info: {
    description: 'Create your blog content';
    displayName: 'Article';
    pluralName: 'articles';
    singularName: 'article';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    author: Schema.Attribute.Relation<'manyToOne', 'api::author.author'>;
    blocks: Schema.Attribute.DynamicZone<
      ['shared.media', 'shared.quote', 'shared.rich-text', 'shared.slider']
    >;
    category: Schema.Attribute.Relation<'manyToOne', 'api::category.category'>;
    cover: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::article.article'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'title'>;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAuthorAuthor extends Struct.CollectionTypeSchema {
  collectionName: 'authors';
  info: {
    description: 'Create authors for your content';
    displayName: 'Author';
    pluralName: 'authors';
    singularName: 'author';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    articles: Schema.Attribute.Relation<'oneToMany', 'api::article.article'>;
    avatar: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::author.author'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiBarAndClubBarAndClub extends Struct.CollectionTypeSchema {
  collectionName: 'bar_and_clubs';
  info: {
    description: '';
    displayName: 'bar-and-club';
    pluralName: 'bar-and-clubs';
    singularName: 'bar-and-club';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    active_orders: Schema.Attribute.Integer;
    amount_sold: Schema.Attribute.Integer;
    booking_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::booking-item.booking-item'
    >;
    close_time: Schema.Attribute.Time;
    completed_orders: Schema.Attribute.Integer;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    debt: Schema.Attribute.Integer;
    drinks: Schema.Attribute.Relation<'oneToMany', 'api::drink.drink'>;
    entryFees: Schema.Attribute.Integer;
    happyHours: Schema.Attribute.Time;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::bar-and-club.bar-and-club'
    > &
      Schema.Attribute.Private;
    location: Schema.Attribute.String;
    name: Schema.Attribute.String;
    open_time: Schema.Attribute.Time;
    publishedAt: Schema.Attribute.DateTime;
    stock_request: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users_permissions_users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiBedBed extends Struct.CollectionTypeSchema {
  collectionName: 'beds';
  info: {
    description: '';
    displayName: 'bed';
    pluralName: 'beds';
    singularName: 'bed';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    bedSize: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::bed.bed'> &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    size: Schema.Attribute.Integer;
    type: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiBookingItemBookingItem extends Struct.CollectionTypeSchema {
  collectionName: 'booking_items';
  info: {
    description: '';
    displayName: 'Booking-item';
    pluralName: 'booking-items';
    singularName: 'booking-item';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    amount_paid: Schema.Attribute.Integer;
    boookings: Schema.Attribute.Relation<'oneToMany', 'api::boooking.boooking'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    drink_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::drink-type.drink-type'
    >;
    drinks: Schema.Attribute.Relation<'oneToMany', 'api::drink.drink'>;
    food_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::food-item.food-item'
    >;
    food_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::food-type.food-type'
    >;
    games: Schema.Attribute.Relation<'oneToMany', 'api::game.game'>;
    gym_membership: Schema.Attribute.Relation<
      'oneToMany',
      'api::gym-membership.gym-membership'
    >;
    hotel_services: Schema.Attribute.Relation<
      'oneToMany',
      'api::hotel-service.hotel-service'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::booking-item.booking-item'
    > &
      Schema.Attribute.Private;
    menu_category: Schema.Attribute.Relation<
      'oneToOne',
      'api::menu-category.menu-category'
    >;
    name: Schema.Attribute.String;
    payment_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::payment-type.payment-type'
    >;
    product_count: Schema.Attribute.Relation<
      'oneToMany',
      'api::product-count.product-count'
    >;
    publishedAt: Schema.Attribute.DateTime;
    quantity: Schema.Attribute.Integer;
    sport_memberships: Schema.Attribute.Relation<
      'oneToMany',
      'api::sport-membership.sport-membership'
    >;
    status: Schema.Attribute.Enumeration<
      ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiBoookingBoooking extends Struct.CollectionTypeSchema {
  collectionName: 'boookings';
  info: {
    description: '';
    displayName: 'booking';
    pluralName: 'boookings';
    singularName: 'boooking';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    bar_and_club: Schema.Attribute.Relation<
      'oneToOne',
      'api::bar-and-club.bar-and-club'
    >;
    booking_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::booking-item.booking-item'
    >;
    booking_status: Schema.Attribute.String;
    bookingId: Schema.Attribute.String;
    checkin: Schema.Attribute.Date;
    checkout: Schema.Attribute.Date;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'oneToOne', 'api::customer.customer'>;
    customerId: Schema.Attribute.String;
    drinks: Schema.Attribute.Relation<'oneToMany', 'api::drink.drink'>;
    food_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::food-item.food-item'
    >;
    guests: Schema.Attribute.Integer;
    hotel_services: Schema.Attribute.Relation<
      'oneToMany',
      'api::hotel-service.hotel-service'
    >;
    isShortRest: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::boooking.boooking'
    > &
      Schema.Attribute.Private;
    nights: Schema.Attribute.Integer;
    payment: Schema.Attribute.Relation<'oneToOne', 'api::payment.payment'>;
    product_count: Schema.Attribute.Relation<
      'oneToOne',
      'api::product-count.product-count'
    >;
    publishedAt: Schema.Attribute.DateTime;
    restaurant: Schema.Attribute.Relation<
      'oneToOne',
      'api::restaurant.restaurant'
    >;
    room: Schema.Attribute.Relation<'oneToOne', 'api::room.room'>;
    timeIn: Schema.Attribute.Time;
    timeOut: Schema.Attribute.Time;
    totalPrice: Schema.Attribute.Integer;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCarrouselCarrousel extends Struct.SingleTypeSchema {
  collectionName: 'carrousels';
  info: {
    description: '';
    displayName: 'Carrousel';
    pluralName: 'carrousels';
    singularName: 'carrousel';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    BannerSlider: Schema.Attribute.Component<'shared.slider', true>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::carrousel.carrousel'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCategoryCategory extends Struct.CollectionTypeSchema {
  collectionName: 'categories';
  info: {
    description: 'Organize your content into categories';
    displayName: 'Category';
    pluralName: 'categories';
    singularName: 'category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    articles: Schema.Attribute.Relation<'oneToMany', 'api::article.article'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::category.category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCheckInCheckIn extends Struct.CollectionTypeSchema {
  collectionName: 'check_ins';
  info: {
    description: '';
    displayName: 'Check-in';
    pluralName: 'check-ins';
    singularName: 'check-in';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    check_in_time: Schema.Attribute.DateTime;
    check_out_time: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    employee_summary: Schema.Attribute.Relation<
      'manyToOne',
      'api::employee-summary.employee-summary'
    >;
    gym_membership: Schema.Attribute.Relation<
      'manyToOne',
      'api::gym-membership.gym-membership'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::check-in.check-in'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sport_membership: Schema.Attribute.Relation<
      'manyToOne',
      'api::sport-membership.sport-membership'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCustomerCustomer extends Struct.CollectionTypeSchema {
  collectionName: 'customers';
  info: {
    description: '';
    displayName: 'customer';
    pluralName: 'customers';
    singularName: 'customer';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    city: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email;
    firstName: Schema.Attribute.String;
    lastName: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::customer.customer'
    > &
      Schema.Attribute.Private;
    nationality: Schema.Attribute.String;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    state: Schema.Attribute.String;
    street: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    zip: Schema.Attribute.Integer;
  };
}

export interface ApiDrinkTypeDrinkType extends Struct.CollectionTypeSchema {
  collectionName: 'drink_types';
  info: {
    displayName: 'drink-type';
    pluralName: 'drink-types';
    singularName: 'drink-type';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::drink-type.drink-type'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    typeName: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiDrinkDrink extends Struct.CollectionTypeSchema {
  collectionName: 'drinks';
  info: {
    description: '';
    displayName: 'drink';
    pluralName: 'drinks';
    singularName: 'drink';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    availability: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    bar_stock: Schema.Attribute.Integer;
    boooking: Schema.Attribute.Relation<'manyToOne', 'api::boooking.boooking'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    drink_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::drink-type.drink-type'
    >;
    image: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::drink.drink'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    price: Schema.Attribute.Integer;
    publishedAt: Schema.Attribute.DateTime;
    quantity: Schema.Attribute.Integer;
    restaurant_stock: Schema.Attribute.Integer;
    sold: Schema.Attribute.Integer;
    supplied: Schema.Attribute.Integer;
    threshold: Schema.Attribute.Integer;
    type: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiEmployeeOrderEmployeeOrder
  extends Struct.CollectionTypeSchema {
  collectionName: 'employee_orders';
  info: {
    description: '';
    displayName: 'Employee Order';
    pluralName: 'employee-orders';
    singularName: 'employee-order';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    amount_paid: Schema.Attribute.Integer;
    bookings: Schema.Attribute.Relation<'oneToMany', 'api::boooking.boooking'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date_issued: Schema.Attribute.Date;
    discount_amount: Schema.Attribute.Integer;
    drinks: Schema.Attribute.Relation<'oneToMany', 'api::drink.drink'>;
    food_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::food-item.food-item'
    >;
    hotel_service: Schema.Attribute.Relation<
      'oneToOne',
      'api::hotel-service.hotel-service'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::employee-order.employee-order'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    total: Schema.Attribute.Integer;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users_permissions_user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiEmployeeRecordEmployeeRecord
  extends Struct.CollectionTypeSchema {
  collectionName: 'employee_records';
  info: {
    description: '';
    displayName: 'Employee Record';
    pluralName: 'employee-records';
    singularName: 'employee-record';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.Date;
    debts: Schema.Attribute.Integer;
    description: Schema.Attribute.Blocks;
    fines: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::employee-record.employee-record'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    salary_advance: Schema.Attribute.Integer;
    shortage: Schema.Attribute.Integer;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users_permissions_user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiEmployeeSummaryEmployeeSummary
  extends Struct.CollectionTypeSchema {
  collectionName: 'employee_summaries';
  info: {
    description: '';
    displayName: 'Employee Summary';
    pluralName: 'employee-summaries';
    singularName: 'employee-summary';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    check_ins: Schema.Attribute.Relation<'oneToMany', 'api::check-in.check-in'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    debt_shortage: Schema.Attribute.Decimal & Schema.Attribute.Required;
    employmentDate: Schema.Attribute.Date;
    fines_debits: Schema.Attribute.Decimal & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::employee-summary.employee-summary'
    > &
      Schema.Attribute.Private;
    order_discount_total: Schema.Attribute.Decimal & Schema.Attribute.Required;
    position: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    salary: Schema.Attribute.Integer;
    salary_advanced: Schema.Attribute.Decimal & Schema.Attribute.Required;
    salary_advanced_status: Schema.Attribute.Enumeration<
      ['pending', 'approved', 'rejected', 'settled']
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users_permissions_user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiExpenseExpense extends Struct.CollectionTypeSchema {
  collectionName: 'expenses';
  info: {
    description: '';
    displayName: 'Expense';
    pluralName: 'expenses';
    singularName: 'expense';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    amount: Schema.Attribute.Integer;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::expense.expense'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    payment_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::payment-type.payment-type'
    >;
    projects: Schema.Attribute.Relation<'oneToMany', 'api::project.project'>;
    publishedAt: Schema.Attribute.DateTime;
    receipts: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users_permissions_user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    vendors: Schema.Attribute.Relation<'manyToMany', 'api::vendor.vendor'>;
  };
}

export interface ApiFloorPlanFloorPlan extends Struct.CollectionTypeSchema {
  collectionName: 'floor_plans';
  info: {
    displayName: 'floor-plan';
    pluralName: 'floor-plans';
    singularName: 'floor-plan';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    floorNumber: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::floor-plan.floor-plan'
    > &
      Schema.Attribute.Private;
    numberOfRooms: Schema.Attribute.Integer;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFoodItemFoodItem extends Struct.CollectionTypeSchema {
  collectionName: 'food_items';
  info: {
    description: '';
    displayName: 'Food-item';
    pluralName: 'food-items';
    singularName: 'food-item';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    boooking: Schema.Attribute.Relation<'manyToOne', 'api::boooking.boooking'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Blocks;
    food_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::food-type.food-type'
    >;
    image: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::food-item.food-item'
    > &
      Schema.Attribute.Private;
    menu_category: Schema.Attribute.Relation<
      'oneToOne',
      'api::menu-category.menu-category'
    >;
    name: Schema.Attribute.String;
    price: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFoodTypeFoodType extends Struct.CollectionTypeSchema {
  collectionName: 'food_types';
  info: {
    displayName: 'food-type';
    pluralName: 'food-types';
    singularName: 'food-type';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::food-type.food-type'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    typeName: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiGameGame extends Struct.CollectionTypeSchema {
  collectionName: 'games';
  info: {
    description: '';
    displayName: 'Game';
    pluralName: 'games';
    singularName: 'game';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    amount_owed: Schema.Attribute.Integer;
    amount_paid: Schema.Attribute.Integer;
    count: Schema.Attribute.Integer;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'oneToOne', 'api::customer.customer'>;
    game_status: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::game.game'> &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users_permissions_user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiGlobalGlobal extends Struct.SingleTypeSchema {
  collectionName: 'globals';
  info: {
    description: 'Define global settings';
    displayName: 'Global';
    pluralName: 'globals';
    singularName: 'global';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultSeo: Schema.Attribute.Component<'shared.seo', false>;
    favicon: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    isVatActive: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::global.global'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    siteDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    siteName: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiGymAndSportSessionGymAndSportSession
  extends Struct.CollectionTypeSchema {
  collectionName: 'gym_and_sport_sessions';
  info: {
    description: '';
    displayName: 'GymAndSport-session';
    pluralName: 'gym-and-sport-sessions';
    singularName: 'gym-and-sport-session';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    gym_and_sports: Schema.Attribute.Relation<
      'manyToMany',
      'api::gym-and-sport.gym-and-sport'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::gym-and-sport-session.gym-and-sport-session'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    schedules: Schema.Attribute.Relation<'oneToMany', 'api::schedule.schedule'>;
    session_fee: Schema.Attribute.Integer;
    session_name: Schema.Attribute.String;
    session_time: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users_permissions_users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiGymAndSportGymAndSport extends Struct.CollectionTypeSchema {
  collectionName: 'gym_and_sports';
  info: {
    description: '';
    displayName: 'Gym-and-Sport';
    pluralName: 'gym-and-sports';
    singularName: 'gym-and-sport';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    CloseTime: Schema.Attribute.Time;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    gym_and_sport_sessions: Schema.Attribute.Relation<
      'manyToMany',
      'api::gym-and-sport-session.gym-and-sport-session'
    >;
    gym_memberships: Schema.Attribute.Relation<
      'manyToMany',
      'api::gym-membership.gym-membership'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::gym-and-sport.gym-and-sport'
    > &
      Schema.Attribute.Private;
    membership_plans: Schema.Attribute.Relation<
      'oneToMany',
      'api::membership-plan.membership-plan'
    >;
    name: Schema.Attribute.String;
    OpenTime: Schema.Attribute.Time;
    publishedAt: Schema.Attribute.DateTime;
    sport_memberships: Schema.Attribute.Relation<
      'manyToMany',
      'api::sport-membership.sport-membership'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiGymMembershipGymMembership
  extends Struct.CollectionTypeSchema {
  collectionName: 'gym_memberships';
  info: {
    description: '';
    displayName: 'Gym Membership';
    pluralName: 'gym-memberships';
    singularName: 'gym-membership';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    check_ins: Schema.Attribute.Relation<'oneToMany', 'api::check-in.check-in'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'oneToOne', 'api::customer.customer'>;
    emergency_contact: Schema.Attribute.String;
    expiry_date: Schema.Attribute.Date;
    gym_and_sports: Schema.Attribute.Relation<
      'manyToMany',
      'api::gym-and-sport.gym-and-sport'
    >;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    joined_date: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::gym-membership.gym-membership'
    > &
      Schema.Attribute.Private;
    membership_plans: Schema.Attribute.Relation<
      'oneToMany',
      'api::membership-plan.membership-plan'
    >;
    payment_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::payment-type.payment-type'
    >;
    product_counts: Schema.Attribute.Relation<
      'oneToMany',
      'api::product-count.product-count'
    >;
    profile_photo: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiHotelServiceHotelService
  extends Struct.CollectionTypeSchema {
  collectionName: 'hotel_services';
  info: {
    description: '';
    displayName: 'hotel-service';
    pluralName: 'hotel-services';
    singularName: 'hotel-service';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    boooking: Schema.Attribute.Relation<'manyToOne', 'api::boooking.boooking'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::hotel-service.hotel-service'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    price: Schema.Attribute.Integer;
    publishedAt: Schema.Attribute.DateTime;
    serviceDescription: Schema.Attribute.Text;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiJobApplicationJobApplication
  extends Struct.CollectionTypeSchema {
  collectionName: 'job_applications';
  info: {
    displayName: 'Job-Application';
    pluralName: 'job-applications';
    singularName: 'job-application';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    address: Schema.Attribute.Text;
    coverLetter: Schema.Attribute.Media<'files'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dob: Schema.Attribute.Date;
    email: Schema.Attribute.Email & Schema.Attribute.Required;
    fullName: Schema.Attribute.String & Schema.Attribute.Required;
    gender: Schema.Attribute.Enumeration<['Male', 'Female', 'Other']>;
    jobExperience: Schema.Attribute.Component<'shared.job-experience', true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::job-application.job-application'
    > &
      Schema.Attribute.Private;
    otherPosition: Schema.Attribute.String;
    phone: Schema.Attribute.String & Schema.Attribute.Required;
    position: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    resume: Schema.Attribute.Media<'files'> & Schema.Attribute.Required;
    skills: Schema.Attribute.Text;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMembershipPlanMembershipPlan
  extends Struct.CollectionTypeSchema {
  collectionName: 'membership_plans';
  info: {
    description: '';
    displayName: 'Membership Plan';
    pluralName: 'membership-plans';
    singularName: 'membership-plan';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    access_to_classes: Schema.Attribute.Boolean;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Blocks;
    discount_amount: Schema.Attribute.Integer;
    duration_months: Schema.Attribute.Integer;
    isActive: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::membership-plan.membership-plan'
    > &
      Schema.Attribute.Private;
    max_checkins_per_month: Schema.Attribute.Integer;
    name: Schema.Attribute.String;
    price: Schema.Attribute.Integer;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMenuCategoryMenuCategory
  extends Struct.CollectionTypeSchema {
  collectionName: 'menu_categories';
  info: {
    displayName: 'menu-category';
    pluralName: 'menu-categories';
    singularName: 'menu-category';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    categoryName: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Blocks;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::menu-category.menu-category'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiOrderOrder extends Struct.CollectionTypeSchema {
  collectionName: 'orders';
  info: {
    description: '';
    displayName: 'order';
    pluralName: 'orders';
    singularName: 'order';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    booking_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::booking-item.booking-item'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'oneToOne', 'api::customer.customer'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::order.order'> &
      Schema.Attribute.Private;
    order_status: Schema.Attribute.Enumeration<['Active', 'Completed']>;
    payment: Schema.Attribute.Relation<'oneToOne', 'api::payment.payment'>;
    payment_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::payment-type.payment-type'
    >;
    publishedAt: Schema.Attribute.DateTime;
    total: Schema.Attribute.Integer;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users_permissions_user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiOrganisationInfoOrganisationInfo
  extends Struct.SingleTypeSchema {
  collectionName: 'organisation_infos';
  info: {
    description: '';
    displayName: 'Organisation-Info';
    pluralName: 'organisation-infos';
    singularName: 'organisation-info';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    address: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email;
    facebook: Schema.Attribute.String;
    instagram: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::organisation-info.organisation-info'
    > &
      Schema.Attribute.Private;
    logo_dark: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    logo_light: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios'
    >;
    name: Schema.Attribute.String;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    twitter: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    website: Schema.Attribute.String;
    youTube: Schema.Attribute.String;
  };
}

export interface ApiPaymentDetailPaymentDetail
  extends Struct.CollectionTypeSchema {
  collectionName: 'payment_details';
  info: {
    displayName: 'payment-detail';
    pluralName: 'payment-details';
    singularName: 'payment-detail';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    bankAccount: Schema.Attribute.BigInteger;
    bankName: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'oneToOne', 'api::customer.customer'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment-detail.payment-detail'
    > &
      Schema.Attribute.Private;
    paymentID: Schema.Attribute.UID;
    payments: Schema.Attribute.Relation<'oneToMany', 'api::payment.payment'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPaymentTypePaymentType extends Struct.CollectionTypeSchema {
  collectionName: 'payment_types';
  info: {
    displayName: 'Payment-type';
    pluralName: 'payment-types';
    singularName: 'payment-type';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment-type.payment-type'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    types: Schema.Attribute.Enumeration<
      ['cash', 'card ', 'bank_transfer ', 'mobile_payment']
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPaymentPayment extends Struct.CollectionTypeSchema {
  collectionName: 'payments';
  info: {
    displayName: 'payment';
    pluralName: 'payments';
    singularName: 'payment';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment.payment'
    > &
      Schema.Attribute.Private;
    paymentMethod: Schema.Attribute.String;
    PaymentStatus: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    totalPrice: Schema.Attribute.Integer;
    transactionID: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiProductCountProductCount
  extends Struct.CollectionTypeSchema {
  collectionName: 'product_counts';
  info: {
    description: '';
    displayName: 'product count';
    pluralName: 'product-counts';
    singularName: 'product-count';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    drink: Schema.Attribute.Relation<'oneToOne', 'api::drink.drink'>;
    food_item: Schema.Attribute.Relation<
      'oneToOne',
      'api::food-item.food-item'
    >;
    game: Schema.Attribute.Relation<'oneToOne', 'api::game.game'>;
    gym_memberships: Schema.Attribute.Relation<
      'oneToMany',
      'api::gym-membership.gym-membership'
    >;
    hotel_service: Schema.Attribute.Relation<
      'oneToOne',
      'api::hotel-service.hotel-service'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::product-count.product-count'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    product_count: Schema.Attribute.Integer;
    publishedAt: Schema.Attribute.DateTime;
    sport_memberships: Schema.Attribute.Relation<
      'oneToMany',
      'api::sport-membership.sport-membership'
    >;
    total_amount: Schema.Attribute.Integer;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiProjectProject extends Struct.CollectionTypeSchema {
  collectionName: 'projects';
  info: {
    displayName: 'Project';
    pluralName: 'projects';
    singularName: 'project';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    budget: Schema.Attribute.Integer;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Blocks;
    end_date: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::project.project'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    start_date: Schema.Attribute.Date;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPromoCouponPromoCoupon extends Struct.CollectionTypeSchema {
  collectionName: 'promo_coupons';
  info: {
    displayName: 'promo-coupon';
    pluralName: 'promo-coupons';
    singularName: 'promo-coupon';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    couponCode: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::promo-coupon.promo-coupon'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiRestaurantRestaurant extends Struct.CollectionTypeSchema {
  collectionName: 'restaurants';
  info: {
    description: '';
    displayName: 'restaurant';
    pluralName: 'restaurants';
    singularName: 'restaurant';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    active_order: Schema.Attribute.Integer;
    amount_sold: Schema.Attribute.Integer;
    booking_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::booking-item.booking-item'
    >;
    close_time: Schema.Attribute.Time;
    completed_orders: Schema.Attribute.Integer;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    debt: Schema.Attribute.Integer;
    drinks: Schema.Attribute.Relation<'oneToMany', 'api::drink.drink'>;
    food_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::food-item.food-item'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::restaurant.restaurant'
    > &
      Schema.Attribute.Private;
    location: Schema.Attribute.String;
    menu_categories: Schema.Attribute.Relation<
      'oneToMany',
      'api::menu-category.menu-category'
    >;
    name: Schema.Attribute.String;
    open_time: Schema.Attribute.Time;
    publishedAt: Schema.Attribute.DateTime;
    stock_request: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users_permissions_users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiRoomRoom extends Struct.CollectionTypeSchema {
  collectionName: 'rooms';
  info: {
    description: '';
    displayName: 'room';
    pluralName: 'rooms';
    singularName: 'room';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    amenities: Schema.Attribute.Relation<'oneToMany', 'api::amenity.amenity'>;
    availability: Schema.Attribute.Integer;
    bed: Schema.Attribute.Relation<'oneToOne', 'api::bed.bed'>;
    boooking: Schema.Attribute.Relation<'oneToOne', 'api::boooking.boooking'>;
    capacity: Schema.Attribute.Integer;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Blocks;
    hotel_services: Schema.Attribute.Relation<
      'oneToMany',
      'api::hotel-service.hotel-service'
    >;
    imgUrl: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::room.room'> &
      Schema.Attribute.Private;
    price: Schema.Attribute.Integer;
    publishedAt: Schema.Attribute.DateTime;
    roomPhotos: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiScheduleSchedule extends Struct.CollectionTypeSchema {
  collectionName: 'schedules';
  info: {
    displayName: 'schedule';
    pluralName: 'schedules';
    singularName: 'schedule';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.DateTime;
    duration: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::schedule.schedule'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    repeat: Schema.Attribute.Boolean;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiServiceService extends Struct.SingleTypeSchema {
  collectionName: 'services';
  info: {
    description: '';
    displayName: 'Service';
    pluralName: 'services';
    singularName: 'service';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::service.service'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    serviceInfo: Schema.Attribute.DynamicZone<
      [
        'shared.rich-text',
        'shared.media',
        'shared.quote',
        'shared.slider',
        'shared.seo',
      ]
    >;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSliderSlider extends Struct.CollectionTypeSchema {
  collectionName: 'sliders';
  info: {
    displayName: 'slider';
    pluralName: 'sliders';
    singularName: 'slider';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::slider.slider'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    slides: Schema.Attribute.Component<'shared.slider', true>;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSpecialInfoSpecialInfo extends Struct.CollectionTypeSchema {
  collectionName: 'special_infos';
  info: {
    description: '';
    displayName: 'Special-offer';
    pluralName: 'special-infos';
    singularName: 'special-info';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    discount: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::special-info.special-info'
    > &
      Schema.Attribute.Private;
    promoEnd: Schema.Attribute.Date;
    promoStart: Schema.Attribute.Date;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSportMembershipSportMembership
  extends Struct.CollectionTypeSchema {
  collectionName: 'sport_memberships';
  info: {
    description: '';
    displayName: 'Sport-Membership';
    pluralName: 'sport-memberships';
    singularName: 'sport-membership';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    check_ins: Schema.Attribute.Relation<'oneToMany', 'api::check-in.check-in'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'oneToOne', 'api::customer.customer'>;
    emergency_contact: Schema.Attribute.String;
    expiry_date: Schema.Attribute.Date;
    gym_and_sports: Schema.Attribute.Relation<
      'manyToMany',
      'api::gym-and-sport.gym-and-sport'
    >;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    joined_date: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sport-membership.sport-membership'
    > &
      Schema.Attribute.Private;
    membership_plans: Schema.Attribute.Relation<
      'oneToMany',
      'api::membership-plan.membership-plan'
    >;
    payment_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::payment-type.payment-type'
    >;
    product_counts: Schema.Attribute.Relation<
      'oneToMany',
      'api::product-count.product-count'
    >;
    profile_photo: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiVendorVendor extends Struct.CollectionTypeSchema {
  collectionName: 'vendors';
  info: {
    displayName: 'Vendor';
    pluralName: 'vendors';
    singularName: 'vendor';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    address: Schema.Attribute.String;
    contact_person: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.String;
    expenses: Schema.Attribute.Relation<'manyToMany', 'api::expense.expense'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::vendor.vendor'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.String;
    caption: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.String;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::about.about': ApiAboutAbout;
      'api::amenity.amenity': ApiAmenityAmenity;
      'api::article.article': ApiArticleArticle;
      'api::author.author': ApiAuthorAuthor;
      'api::bar-and-club.bar-and-club': ApiBarAndClubBarAndClub;
      'api::bed.bed': ApiBedBed;
      'api::booking-item.booking-item': ApiBookingItemBookingItem;
      'api::boooking.boooking': ApiBoookingBoooking;
      'api::carrousel.carrousel': ApiCarrouselCarrousel;
      'api::category.category': ApiCategoryCategory;
      'api::check-in.check-in': ApiCheckInCheckIn;
      'api::customer.customer': ApiCustomerCustomer;
      'api::drink-type.drink-type': ApiDrinkTypeDrinkType;
      'api::drink.drink': ApiDrinkDrink;
      'api::employee-order.employee-order': ApiEmployeeOrderEmployeeOrder;
      'api::employee-record.employee-record': ApiEmployeeRecordEmployeeRecord;
      'api::employee-summary.employee-summary': ApiEmployeeSummaryEmployeeSummary;
      'api::expense.expense': ApiExpenseExpense;
      'api::floor-plan.floor-plan': ApiFloorPlanFloorPlan;
      'api::food-item.food-item': ApiFoodItemFoodItem;
      'api::food-type.food-type': ApiFoodTypeFoodType;
      'api::game.game': ApiGameGame;
      'api::global.global': ApiGlobalGlobal;
      'api::gym-and-sport-session.gym-and-sport-session': ApiGymAndSportSessionGymAndSportSession;
      'api::gym-and-sport.gym-and-sport': ApiGymAndSportGymAndSport;
      'api::gym-membership.gym-membership': ApiGymMembershipGymMembership;
      'api::hotel-service.hotel-service': ApiHotelServiceHotelService;
      'api::job-application.job-application': ApiJobApplicationJobApplication;
      'api::membership-plan.membership-plan': ApiMembershipPlanMembershipPlan;
      'api::menu-category.menu-category': ApiMenuCategoryMenuCategory;
      'api::order.order': ApiOrderOrder;
      'api::organisation-info.organisation-info': ApiOrganisationInfoOrganisationInfo;
      'api::payment-detail.payment-detail': ApiPaymentDetailPaymentDetail;
      'api::payment-type.payment-type': ApiPaymentTypePaymentType;
      'api::payment.payment': ApiPaymentPayment;
      'api::product-count.product-count': ApiProductCountProductCount;
      'api::project.project': ApiProjectProject;
      'api::promo-coupon.promo-coupon': ApiPromoCouponPromoCoupon;
      'api::restaurant.restaurant': ApiRestaurantRestaurant;
      'api::room.room': ApiRoomRoom;
      'api::schedule.schedule': ApiScheduleSchedule;
      'api::service.service': ApiServiceService;
      'api::slider.slider': ApiSliderSlider;
      'api::special-info.special-info': ApiSpecialInfoSpecialInfo;
      'api::sport-membership.sport-membership': ApiSportMembershipSportMembership;
      'api::vendor.vendor': ApiVendorVendor;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
