// types/react-native-get-sms-android/index.d.ts

declare module 'react-native-get-sms-android' {
    interface SMSOptions {
      /** Type of SMS to get: 'inbox' (default), 'sent', 'draft', 'outbox', 'failed', 'queued', or '' for all */
      box?: string;
      /** Start position to get SMS, default is 0 */
      indexFrom?: number;
      /** Max number of SMS to retrieve, default is 10 */
      maxCount?: number;
      /** Address/phone number to filter by */
      address?: string;
      /** Body content to filter by */
      body?: string;
      /** Read status to filter by (0 for unread, 1 for read) */
      read?: number;
      /** Minimum date in milliseconds to filter by */
      minDate?: number;
      /** Maximum date in milliseconds to filter by */
      maxDate?: number;
      /** Thread ID to filter by */
      threadId?: string;
      /** Format of the returned message list */
      format?: 'json' | 'flat';
    }
  
    interface SMS {
      _id: string;
      thread_id: string;
      address: string;
      person?: string;
      date: string;
      date_sent: string;
      protocol: string;
      read: number;
      status: number;
      type: number;
      service_center?: string;
      body: string;
      locked?: number;
      error_code?: number;
      sub_id?: string;
      seen?: number;
    }
  
    /**
     * Get all SMS messages
     * @param options JSON encoded filter options
     * @param errorCallback Callback function called on error
     * @param successCallback Callback function called on success with count and messages
     */
    export function list(
      options: string,
      errorCallback: (error: string) => void,
      successCallback: (count: number, messages: string) => void
    ): void;
  
    /**
     * Delete SMS by ID
     * @param messageId ID of the message to delete
     * @param successCallback Callback function called on success
     * @param errorCallback Callback function called on error
     */
    export function delete(
      messageId: string,
      successCallback: (success: boolean) => void,
      errorCallback: (error: string) => void
    ): void;
  
    /**
     * Send SMS
     * @param phoneNumber Phone number to send SMS to
     * @param message Message body to send
     * @param successCallback Callback function called on success
     * @param errorCallback Callback function called on error
     */
    export function send(
      phoneNumber: string,
      message: string,
      successCallback: (success: boolean) => void,
      errorCallback: (error: string) => void
    ): void;
  }
  
  export default SmsAndroid;