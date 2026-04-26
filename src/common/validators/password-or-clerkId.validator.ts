import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions
} from 'class-validator';

export function PasswordOrClerkId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'PasswordOrClerkId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_: any, args: ValidationArguments) {
          const { password, clerkId } = args.object as any;
          // ✅ Exactamente uno de los dos debe estar presente
          return (!!password && !clerkId) || (!password && !!clerkId);
        },
        defaultMessage() {
          return 'User must have either password or clerkId, but not both';
        }
      }
    });
  };
}
